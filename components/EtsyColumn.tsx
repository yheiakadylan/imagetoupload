import React from 'react';
import { LogEntry, Status, User } from '../types';
import Button from './common/Button';
import Spinner from './common/Spinner';

interface EtsyColumnProps {
    selectedMockup: LogEntry | null;
    user: User | null;
    showStatus: (message: string, type: Status['type'], duration?: number) => void;
    onGenerate: (mockupToUse: LogEntry | null) => void;
    generatedTitle: string;
    generatedTags: string[];
    isLoading: boolean;
}

const EtsyColumn: React.FC<EtsyColumnProps> = ({ 
    selectedMockup, 
    user, 
    showStatus,
    onGenerate,
    generatedTitle,
    generatedTags,
    isLoading 
}) => {

    const handleCopy = (text: string, type: 'Title' | 'Tags') => {
        navigator.clipboard.writeText(text);
        showStatus(`${type} copied to clipboard!`, 'ok', 2000);
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex flex-col min-h-0 backdrop-blur-lg h-full overflow-y-auto">
            <h2 className="text-lg font-bold mb-2">Etsy Uploader</h2>

            <div className="space-y-3">
                {/* --- PREVIEWS --- */}
                <div className="h-40 bg-black/20 rounded-lg p-2 flex items-center justify-center text-center">
                    {selectedMockup ? (
                        <img src={selectedMockup.dataUrl} className="max-w-full max-h-full object-contain rounded" alt="Selected Mockup"/>
                    ) : (
                        <div className="text-sm text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Select a Mockup to Continue
                        </div>
                    )}
                </div>

                <Button onClick={() => onGenerate(selectedMockup)} disabled={isLoading || !selectedMockup} className="w-full py-2.5">
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
                        onClick={() => showStatus('Etsy integration not yet implemented.', 'info')} 
                        className="w-full py-2.5"
                        disabled={!generatedTitle}
                    >
                        Upload to Etsy (Coming Soon)
                    </Button>
                 </div>
            </div>
        </div>
    );
};

export default EtsyColumn;