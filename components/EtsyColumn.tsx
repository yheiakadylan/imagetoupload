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

    // When a mockup is selected from the other column, it should clear the local one.
    useEffect(() => {
        setLocalMockupUrl(null);
    }, [selectedMockup]);

    const activeImageUrl = localMockupUrl || selectedMockup?.dataUrl;

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
            <h2 className="text-lg font-bold mb-2">Etsy Helper</h2>

            <div className="space-y-3">
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
                 <div className="pt-3 border-t border-white/10">
                     <Button 
                        variant="primary" 
                        onClick={onOpenUploadModal} 
                        className="w-full py-2.5"
                    >
                        Upload to Etsy
                    </Button>
                 </div>
            </div>
        </div>
    );
};

export default EtsyColumn;
