import React, { useState, useEffect } from 'react';
import { LogEntry, Status, User } from '../types';
import Button from './common/Button';
import Spinner from './common/Spinner';
import { fileToBase64, readImagesFromClipboard } from '../utils/fileUtils';

interface EtsyColumnProps {
    selectedMockup: LogEntry | null;
    user: User | null;
    showStatus: (message: string, type: Status['type'], duration?: number) => void;
    onGenerate: (mockupToUse: LogEntry | null) => void;
    generatedTitle: string;
    generatedTags: string[];
    isLoading: boolean;
    onOpenUploadModal: () => void;
}

const EtsyColumn: React.FC<EtsyColumnProps> = ({ 
    selectedMockup, 
    user, 
    showStatus,
    onGenerate,
    generatedTitle,
    generatedTags,
    isLoading,
    onOpenUploadModal
}) => {
    const [localMockupUrl, setLocalMockupUrl] = useState<string | null>(null);
    const [isManualMode, setIsManualMode] = useState(false);


    // When a mockup is selected from the other column, it should clear the local one.
    useEffect(() => {
        setLocalMockupUrl(null);
    }, [selectedMockup]);

    const activeImageUrl = localMockupUrl || selectedMockup?.dataUrl;
    const isEtsyConnected = !!user?.etsy_access_token;
    const showGeneratorUI = isEtsyConnected || isManualMode;

    const handleConnectToEtsy = () => {
        if (user) {
            window.location.href = `/api/auth/etsy-redirect?userId=${user.id}`;
        }
    };

    const handleCopy = (text: string, type: 'Title' | 'Tags') => {
        navigator.clipboard.writeText(text);
        showStatus(`${type} copied to clipboard!`, 'ok', 2000);
    };

    const handleAddFromFile = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const dataUrl = await fileToBase64(file);
                setLocalMockupUrl(dataUrl);
            }
        };
        input.click();
    };

    const handlePaste = async () => {
        try {
            const dataUrls = await readImagesFromClipboard();
            if (dataUrls.length > 0) {
                setLocalMockupUrl(dataUrls[0]);
                showStatus('Image pasted!', 'ok');
            } else {
                showStatus('No image found on clipboard.', 'warn');
            }
        } catch (error: any) {
            showStatus(error.message, 'err');
        }
    };

    const handleGenerateClick = () => {
        let mockupToUse: LogEntry | null = null;
        if (localMockupUrl) {
            mockupToUse = {
                id: `local-${Date.now()}`,
                type: 'mockup',
                prompt: 'Locally provided mockup for Etsy generation',
                dataUrl: localMockupUrl,
                createdAt: Date.now()
            };
        } else if (selectedMockup) {
            mockupToUse = selectedMockup;
        }
        onGenerate(mockupToUse);
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex flex-col min-h-0 backdrop-blur-lg h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
                 <h2 className="text-lg font-bold">Etsy Helper</h2>
                 {isEtsyConnected && (
                    <div className="flex items-center gap-2 text-xs font-bold bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        Etsy Connected
                    </div>
                 )}
                 {isManualMode && !isEtsyConnected && (
                    <div className="flex items-center gap-2 text-xs font-bold bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                        Manual Mode
                    </div>
                 )}
            </div>

            {!showGeneratorUI ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center bg-black/20 rounded-lg p-4">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <h3 className="text-lg font-bold text-white mb-1">Connect to Etsy</h3>
                    <p className="text-sm text-gray-400 mb-4 max-w-xs">
                        Connect your account to upload listings and fetch templates.
                    </p>
                    <div className="flex items-center gap-3">
                        <Button variant="primary" onClick={handleConnectToEtsy}>
                            Connect to Etsy
                        </Button>
                        <Button variant="ghost" onClick={() => setIsManualMode(true)}>
                            Generate Manually
                        </Button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-400 max-w-xs">
                        <p className="font-bold mb-1">Having trouble connecting?</p>
                        <p>
                            If your app on Etsy is stuck in a "pending" state, you may not be able to change settings.
                            Please contact <a href="https://www.etsy.com/developers/support" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Etsy Developer Support</a> to resolve this issue.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {isManualMode && !isEtsyConnected && (
                        <div className="bg-yellow-500/10 text-yellow-300 text-sm p-2 rounded-lg text-center">
                            <strong>Manual Mode:</strong> Generate content now. 
                             <button onClick={() => setIsManualMode(false)} className="font-bold underline ml-2 hover:text-yellow-200">Connect to Etsy</button> to upload.
                        </div>
                    )}
                    {/* --- PREVIEWS --- */}
                    <div className="h-40 bg-black/20 rounded-lg p-2 flex items-center justify-center text-center group relative">
                        {activeImageUrl ? (
                             <>
                                <img src={activeImageUrl} className="max-w-full max-h-full object-contain rounded" alt="Selected Mockup"/>
                                {localMockupUrl && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="warn" className="!text-xs !px-2 !py-1" onClick={() => setLocalMockupUrl(null)}>
                                            Clear
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Select a Mockup, or Add/Paste one here
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" onClick={handleAddFromFile}>Add Image...</Button>
                        <Button variant="ghost" onClick={handlePaste}>Paste Image</Button>
                    </div>

                    <Button onClick={handleGenerateClick} disabled={isLoading || !activeImageUrl} className="w-full py-2.5">
                        {isLoading ? <><Spinner className="mr-2"/> Generating...</> : 'Generate / Regenerate'}
                    </Button>
                    
                    {/* --- OUTPUTS --- */}
                    {(generatedTitle || generatedTags.length > 0) && (
                        <div className="space-y-3 pt-3 border-t border-white/10">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-semibold text-gray-300">Generated Title</h4>
                                    {generatedTitle && <Button variant="ghost" className="!text-xs !px-2 !py-1" onClick={() => handleCopy(generatedTitle, 'Title')}>Copy</Button>}
                                </div>
                                <p className="p-2 bg-black/20 rounded-md text-sm text-gray-200 min-h-[40px]">{generatedTitle}</p>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-semibold text-gray-300">Generated Tags ({generatedTags.length})</h4>
                                    {generatedTags.length > 0 && <Button variant="ghost" className="!text-xs !px-2 !py-1" onClick={() => handleCopy(generatedTags.join(', '), 'Tags')}>Copy All</Button>}
                                </div>
                                <div className="p-2 bg-black/20 rounded-md flex flex-wrap gap-2 min-h-[52px]">
                                    {generatedTags.map((tag, index) => (
                                        <span key={index} className="bg-gray-600 text-white text-xs font-medium px-2 py-1 rounded-full">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                     {/* --- UPLOAD --- */}
                     {isEtsyConnected && (
                         <div className="pt-3 border-t border-white/10">
                             <Button 
                                variant="primary" 
                                onClick={onOpenUploadModal} 
                                className="w-full py-2.5"
                            >
                                Upload to Etsy
                            </Button>
                         </div>
                     )}
                </div>
            )}
        </div>
    );
};

export default EtsyColumn;