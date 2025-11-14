import React, { useState, useEffect } from 'react';
import { LogEntry, Status, User, EtsyDescriptionTemplate } from '../types';
import { useTemplates } from '../hooks/useTemplates';
import Button from './common/Button';
import Select from './common/Select';
import TextArea from './common/TextArea';
import Spinner from './common/Spinner';
import { fileToBase64, readImagesFromClipboard, uploadDataUrlToStorage } from '../utils/fileUtils';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface EtsyUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    mockups: LogEntry[];
    onMockupsChange: React.Dispatch<React.SetStateAction<LogEntry[]>>;
    generatedTitle: string;
    generatedTags: string[];
    user: User | null;
    showStatus: (message: string, type: Status['type'], duration?: number) => void;
}

const EtsyUploadModal: React.FC<EtsyUploadModalProps> = ({
    isOpen,
    onClose,
    mockups,
    onMockupsChange,
    generatedTitle,
    generatedTags,
    user,
    showStatus
}) => {
    // --- State Management ---
    const { templates: descriptionTemplates } = useTemplates<EtsyDescriptionTemplate>('ETSY_DESCRIPTION_TEMPLATES');
    
    const [title, setTitle] = useState(generatedTitle);
    const [tags, setTags] = useState(generatedTags.join(', '));
    const [description, setDescription] = useState('');
    const [selectedDescTemplateId, setSelectedDescTemplateId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // --- Effects to sync with props and template selections ---
    useEffect(() => {
        if (isOpen) {
            setTitle(generatedTitle);
            setTags(generatedTags.join(', '));
            setDescription(''); // Reset description on open
            setSelectedDescTemplateId('');
        }
    }, [isOpen, generatedTitle, generatedTags]);

    useEffect(() => {
        if (!selectedDescTemplateId) return;
        
        const selectedTemplate = descriptionTemplates.find(t => t.id === selectedDescTemplateId);
        if (selectedTemplate) {
            setDescription(selectedTemplate.content);
        }
    }, [selectedDescTemplateId, descriptionTemplates]);
    
    // --- Mockup Management Handlers ---
    const handleRemoveMockup = (idToRemove: string) => {
        onMockupsChange(currentMockups => currentMockups.filter(m => m.id !== idToRemove));
    };

    const handleAddMockupsFromFile = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files) return;
            const newMockups: LogEntry[] = [];
            for (const file of Array.from(files)) {
                const dataUrl = await fileToBase64(file);
                newMockups.push({
                    id: `manual-${Date.now()}-${Math.random()}`,
                    type: 'mockup',
                    prompt: 'Manually added',
                    dataUrl,
                    createdAt: Date.now(),
                });
            }
            onMockupsChange(current => [...current, ...newMockups]);
        };
        input.click();
    };

    const handlePasteMockup = async () => {
        try {
            const dataUrls = await readImagesFromClipboard();
            const newMockups = dataUrls.map(dataUrl => ({
                id: `manual-paste-${Date.now()}-${Math.random()}`,
                type: 'mockup' as const,
                prompt: 'Pasted image',
                dataUrl,
                createdAt: Date.now(),
            }));
            if (newMockups.length > 0) {
                 onMockupsChange(current => [...current, ...newMockups]);
                 showStatus(`Pasted ${newMockups.length} image(s).`, 'ok');
            } else {
                showStatus('No image found on clipboard.', 'warn');
            }
        } catch (error: any) {
            showStatus(`Paste failed: ${error.message}`, 'err');
        }
    };

    /**
     * Main Function: Save the prepared listing for the browser extension.
     */
    const handleSaveForExtension = async () => {
        if (mockups.length === 0) {
            showStatus('Please add at least one mockup image.', 'warn'); return;
        }
        if (!title.trim() || tags.trim().length === 0) {
            showStatus('Title and Tags are required.', 'warn'); return;
        }
        if (!description.trim()) {
            showStatus('Description is required.', 'warn'); return;
        }
        if (!user) {
            showStatus('User not found. Please log in again.', 'err');
            return;
        }

        setIsSaving(true);
        showStatus('Saving listing for extension...', 'info');

        try {
            // 1. Upload any local (base64) mockups to get permanent URLs
            const finalMockupUrls: string[] = [];
            for (const mockup of mockups) {
                if (mockup.dataUrl.startsWith('data:image/')) {
                    const storagePath = `prepared_listings/${user.id}/${Date.now()}-${Math.random()}.png`;
                    const { downloadUrl } = await uploadDataUrlToStorage(mockup.dataUrl, storagePath);
                    finalMockupUrls.push(downloadUrl);
                } else {
                    finalMockupUrls.push(mockup.dataUrl); // It's already a URL
                }
            }

            // 2. Prepare the data package for Firestore
            const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);

            const listingPackage = {
                ownerUid: user.id,
                title: title,
                tags: tagsArray,
                description: description,
                mockupUrls: finalMockupUrls,
                sku: '', // Not managed in this modal
                status: "pending",
                createdAt: Date.now(),
            };

            // 3. Save to Firestore
            await addDoc(collection(db, 'prepared_listings'), listingPackage);
            
            showStatus('Listing saved! Please open the browser extension on Etsy.', 'ok', 4000);
            onClose();

        } catch (error: any) {
            console.error("Failed to save for extension:", error);
            showStatus(`Save failed: ${error.message}`, 'err', 5000);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-lg animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-gray-900/80 border border-white/20 rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-2xl font-bold">Etsy Upload Manager</h2>
                    <Button variant="ghost" onClick={onClose} className="!px-3 !py-1">✕</Button>
                </header>

                <main className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
                    <div className="bg-black/20 rounded-lg p-3 space-y-3 flex flex-col flex-1 min-h-0">
                        
                        {/* Mockups Section */}
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-gray-300">Mockup Images ({mockups.length})</h4>
                            <div className="flex gap-2">
                                <Button variant="ghost" className="!text-xs !py-1 !px-2" onClick={handleAddMockupsFromFile}>Add</Button>
                                <Button variant="ghost" className="!text-xs !py-1 !px-2" onClick={handlePasteMockup}>Paste</Button>
                            </div>
                        </div>
                        <div className="flex-1 bg-black/20 rounded-lg p-2 text-center overflow-y-auto min-h-[150px]">
                            {mockups.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {mockups.map(mockup => (
                                        <div key={mockup.id} className="relative group aspect-square">
                                            <img src={mockup.dataUrl} className="w-full h-full object-contain rounded bg-black/10" alt="Selected Mockup"/>
                                            <button
                                                onClick={() => handleRemoveMockup(mockup.id)}
                                                className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                aria-label="Remove mockup"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-sm text-gray-500">Add or paste mockup images.</p>
                                </div>
                            )}
                        </div>

                        {/* Title Section */}
                        <div>
                            <label className="text-sm font-semibold text-gray-300 mb-1 block">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Tags Section */}
                        <div>
                            <label className="text-sm font-semibold text-gray-300 mb-1 block">Tags</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="tag one, tag two, tag three"
                                className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                             <p className="text-xs text-gray-500 mt-1">Separate tags with commas.</p>
                        </div>
                        
                        {/* Description Section */}
                        <div className="flex flex-col flex-grow">
                             <label className="text-sm font-semibold text-gray-300 mb-1 block">Description</label>
                             <Select value={selectedDescTemplateId} onChange={e => setSelectedDescTemplateId(e.target.value)} className="mb-2">
                                <option value="">— Use Custom Description or Select Template —</option>
                                {descriptionTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                            <TextArea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="flex-grow min-h-[120px]"
                                placeholder="Enter the product description here..."
                            />
                        </div>

                        {/* Action Button */}
                        <div className="pt-3 border-t border-white/10 mt-auto">
                            <Button 
                                variant="primary" 
                                onClick={handleSaveForExtension} 
                                className="w-full py-3"
                                disabled={isSaving}
                            >
                                {isSaving ? <><Spinner className="mr-2"/> SAVING...</> : 'Lưu cho Extension'}
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default EtsyUploadModal;
