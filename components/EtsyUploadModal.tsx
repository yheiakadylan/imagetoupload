import React, { useState, useEffect } from 'react';
import { LogEntry, Status, User, EtsyListingTemplate, EtsyDescriptionTemplate } from '../types';
import { useTemplates } from '../hooks/useTemplates';
import Button from './common/Button';
import Select from './common/Select';
import TextArea from './common/TextArea';
import Spinner from './common/Spinner';
import { fileToBase64, readImagesFromClipboard } from '../utils/fileUtils';

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
    // --- State Quản lý Khuôn mẫu ---
    const { templates: etsyTemplates, addTemplate, deleteTemplate } = useTemplates<EtsyListingTemplate>('ETSY_TEMPLATES');
    const { templates: descriptionTemplates } = useTemplates<EtsyDescriptionTemplate>('ETSY_DESCRIPTION_TEMPLATES');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedDescTemplateId, setSelectedDescTemplateId] = useState<string>('');
    
    // --- State Quản lý Dữ liệu Tạm thời ---
    const [listingIdToFetch, setListingIdToFetch] = useState<string>(''); // Ô nhập ID listing mẫu
    const [templateName, setTemplateName] = useState<string>(''); // Tên khuôn mẫu mới
    const [templateDescription, setTemplateDescription] = useState<string>(''); // Mô tả
    const [templateInventory, setTemplateInventory] = useState<string>('{}'); // JSON Inventory
    const [templateTaxonomyId, setTemplateTaxonomyId] = useState<string>(''); // Dùng string cho input
    const [templateShippingId, setTemplateShippingId] = useState<string>(''); // Dùng string cho input
    const [templateReturnId, setTemplateReturnId] = useState<string>(''); // Dùng string cho input
    const [templateWhoMade, setTemplateWhoMade] = useState<string>('i_did');
    const [templateWhenMade, setTemplateWhenMade] = useState<string>('made_to_order');
    const [templateReadinessId, setTemplateReadinessId] = useState<string>('');


    // --- State Trạng thái ---
    const [isFetching, setIsFetching] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Tự động chọn khuôn mẫu đầu tiên (nếu có) khi mở
    useEffect(() => {
        if (isOpen && etsyTemplates.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(etsyTemplates[0].id);
        }
    }, [isOpen, etsyTemplates, selectedTemplateId]);

    // Khi người dùng chọn một khuôn mẫu, cập nhật các ô dữ liệu
    useEffect(() => {
        const activeTemplate = etsyTemplates.find(t => t.id === selectedTemplateId);
        if (activeTemplate) {
            setTemplateName(activeTemplate.name);
            setTemplateDescription(activeTemplate.description);
            setTemplateInventory(activeTemplate.inventory);
            setTemplateTaxonomyId(String(activeTemplate.taxonomyId));
            setTemplateShippingId(String(activeTemplate.shippingProfileId));
            setTemplateReturnId(String(activeTemplate.returnPolicyId));
            setTemplateWhoMade(activeTemplate.who_made || 'i_did');
            setTemplateWhenMade(activeTemplate.when_made || 'made_to_order');
            setTemplateReadinessId(activeTemplate.readiness_state_id || '');
            setSelectedDescTemplateId('');
        }
    }, [selectedTemplateId, etsyTemplates]);

     // Khi người dùng chọn một khuôn mẫu MÔ TẢ, cập nhật trường mô tả
    useEffect(() => {
        if (!selectedDescTemplateId) return; // Không làm gì nếu người dùng chọn placeholder
        const selectedTemplate = descriptionTemplates.find(t => t.id === selectedDescTemplateId);
        if (selectedTemplate) {
            setTemplateDescription(selectedTemplate.content);
        }
    }, [selectedDescTemplateId, descriptionTemplates]);
    
    // --- New Handlers for Mockup Management ---
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


    const handleClearForm = () => {
        setSelectedTemplateId('');
        setSelectedDescTemplateId('');
        setTemplateName('');
        setTemplateDescription('');
        setTemplateInventory('{}');
        setTemplateTaxonomyId('');
        setTemplateShippingId('');
        setTemplateReturnId('');
        setTemplateWhoMade('i_did');
        setTemplateWhenMade('made_to_order');
        setTemplateReadinessId('');
        setListingIdToFetch('');
    };

    /**
     * HÀM 1: LẤY DỮ LIỆU TỪ LISTING MẪU (Copy 1 lần)
     */
    const handleFetchFromEtsy = async () => {
        if (!listingIdToFetch) {
            showStatus('Vui lòng nhập Listing ID mẫu.', 'warn');
            return;
        }
        
        setIsFetching(true);
        showStatus('Đang lấy dữ liệu từ Etsy...', 'info');

        try {
            // *** TODO: YÊU CẦU BACKEND ***
            // Gọi Vercel Function /api/fetchEtsyListing
            // const response = await fetch(`/api/fetchEtsyListing?id=${listingIdToFetch}`);
            // const data = await response.json();
            // if (!response.ok) throw new Error(data.error || 'Lỗi từ Vercel Function');
            // const { listingData, inventoryData } = data;
            
            // --- DỮ LIỆU GIẢ ĐỊNH (PHẢI THAY BẰNG GỌI BACKEND THẬT) ---
            await new Promise(res => setTimeout(res, 1000)); // Giả lập chờ
            const listingData = {
                title: "Fetched T-Shirt",
                description: "This is a fetched description.\n100% Cotton.",
                taxonomy_id: 123456,
                shipping_profile_id: 987654321,
                return_policy_id: 123456789,
                who_made: "someone_else",
                when_made: "2020_2024",
            };
            const inventoryData = {
                "products": [
                    {"sku": "SKU-S", "offerings": [{"price": 25.00, "quantity": 999}], "property_values": "[...]"},
                    {"sku": "SKU-M", "offerings": [{"price": 25.00, "quantity": 999}], "property_values": "[...]"}
                ],
                "pricing_on_property": 503
            };
            // --- Hết Dữ liệu giả định ---

            setTemplateName(listingData.title + " (Copy)");
            setTemplateDescription(listingData.description);
            setTemplateTaxonomyId(String(listingData.taxonomy_id));
            setTemplateShippingId(String(listingData.shipping_profile_id));
            setTemplateReturnId(String(listingData.return_policy_id));
            setTemplateWhoMade(listingData.who_made);
            setTemplateWhenMade(listingData.when_made);
            setTemplateReadinessId(''); // Not a standard fetched field
            setTemplateInventory(JSON.stringify(inventoryData, null, 2));
            setSelectedDescTemplateId('');

            showStatus('Lấy dữ liệu thành công! Hãy đặt tên và lưu lại.', 'ok');
            
        } catch (error: any) {
            showStatus(`Lỗi: ${error.message}`, 'err');
        } finally {
            setIsFetching(false);
        }
    };

    /**
     * HÀM 2: LƯU KHUÔN MẪU (Lưu lại)
     */
    const handleSaveTemplate = async () => {
        if (!templateName || !templateDescription || !templateShippingId || !templateTaxonomyId || !templateWhoMade || !templateWhenMade) {
            showStatus('Tên, Mô tả, Taxonomy ID, Shipping ID, Who Made và When Made là bắt buộc.', 'warn');
            return;
        }
        setIsSaving(true);
        try {
            const newTemplate: Omit<EtsyListingTemplate, 'id' | 'createdAt'> = {
                name: templateName,
                description: templateDescription,
                taxonomyId: parseInt(templateTaxonomyId) || 0,
                shippingProfileId: parseInt(templateShippingId) || 0,
                returnPolicyId: parseInt(templateReturnId) || 0,
                inventory: templateInventory,
                who_made: templateWhoMade as any,
                when_made: templateWhenMade,
                readiness_state_id: templateReadinessId,
            };
            
            const savedDoc = await addTemplate(newTemplate as any);
            setSelectedTemplateId(savedDoc.id); // Tự động chọn khuôn mẫu vừa lưu
            showStatus('Đã lưu khuôn mẫu!', 'ok');

        } catch (error: any) {
             showStatus(`Lỗi lưu khuôn mẫu: ${error.message}`, 'err');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!selectedTemplateId) {
            showStatus('Chưa chọn khuôn mẫu để xóa.', 'warn');
            return;
        }
        if (window.confirm("Bạn có chắc muốn xóa khuôn mẫu này?")) {
            try {
                await deleteTemplate(selectedTemplateId);
                showStatus('Đã xóa khuôn mẫu.', 'ok');
                handleClearForm();
            } catch (error: any) {
                showStatus(`Lỗi xóa: ${error.message}`, 'err');
            }
        }
    };

    /**
     * HÀM 3: UPLOAD SẢN PHẨM MỚI
     */
    const handleUploadToEtsy = async () => {
        if (mockups.length === 0) {
            showStatus('Chưa có mockup để upload.', 'warn'); return;
        }
        if (!generatedTitle || generatedTags.length === 0) {
            showStatus('Chưa tạo Title hoặc Tags.', 'warn'); return;
        }
        if (!templateShippingId || !templateTaxonomyId || !templateWhoMade || !templateWhenMade) {
            showStatus('Khuôn mẫu thiếu Taxonomy ID, Shipping ID, Who Made hoặc When Made.', 'warn'); return;
        }

        setIsUploading(true);
        showStatus('Đang upload lên Etsy... (Giả lập)', 'info');

        try {
            const activeTemplate = etsyTemplates.find(t => t.id === selectedTemplateId);
            if (!activeTemplate) throw new Error("Không tìm thấy khuôn mẫu đã chọn.");

            const finalPayload = {
                listing: {
                    title: generatedTitle,
                    description: templateDescription,
                    tags: generatedTags,
                    taxonomy_id: parseInt(templateTaxonomyId),
                    shipping_profile_id: parseInt(templateShippingId),
                    return_policy_id: parseInt(templateReturnId) || null,
                    who_made: templateWhoMade,
                    when_made: templateWhenMade,
                    readiness_state_id: templateReadinessId,
                    state: 'active' // Hoặc 'draft'
                },
                inventory: JSON.parse(templateInventory),
                imageDataUrls: mockups.map(m => m.dataUrl)
            };
            
            // *** TODO: YÊU CẦU BACKEND ***
            // Gọi Vercel Function /api/uploadEtsyListing
            // const response = await fetch(`/api/uploadEtsyListing`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(finalPayload)
            // });
            // const result = await response.json();
            // if (!response.ok) throw new Error(result.error);
            
            // --- DỮ LIỆU GIẢ LẬP (PHẢI THAY BẰNG GỌI BACKEND THẬT) ---
            await new Promise(res => setTimeout(res, 2000));
            const new_listing_id = Math.floor(Math.random() * 1000000);
            // const result = { new_listing_id: new_listing_id };
            // --- Hết Giả lập ---
            
            showStatus(`Tạo listing ${new_listing_id} thành công!`, 'ok');
            onClose(); // Tự động đóng popup khi thành công

        } catch (error: any) {
            showStatus(`Upload thất bại: ${error.message}`, 'err');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-lg animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-gray-900/80 border border-white/20 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-2xl font-bold">Etsy Upload Manager</h2>
                    <Button variant="ghost" onClick={onClose} className="!px-3 !py-1">✕</Button>
                </header>

                <main className="flex-1 grid md:grid-cols-2 gap-4 p-4 overflow-y-auto">
                    
                    {/* --- CỘT BÊN TRÁI: KHUÔN MẪU (Template) --- */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-bold">1. Chọn/Tạo Khuôn mẫu Upload</h3>
                        <div className="bg-black/20 rounded-lg p-3 space-y-2">
                            <label className="text-sm font-semibold">Tải khuôn mẫu đã lưu</label>
                            <Select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} disabled={etsyTemplates.length === 0}>
                                <option value="">{etsyTemplates.length > 0 ? '— Chọn khuôn mẫu —' : 'Chưa có khuôn mẫu'}</option>
                                {etsyTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </Select>
                        </div>
                        
                        <div className="bg-black/20 rounded-lg p-3 space-y-2">
                            <label className="text-sm font-semibold">...hoặc Fetch từ Listing ID</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Dán Listing ID mẫu..."
                                    value={listingIdToFetch}
                                    onChange={e => setListingIdToFetch(e.target.value)}
                                    className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none text-sm"
                                />
                                <Button variant="ghost" onClick={handleFetchFromEtsy} disabled={isFetching} className="flex-shrink-0">
                                    {isFetching ? <Spinner /> : 'Fetch'}
                                </Button>
                            </div>
                        </div>

                        <div className="bg-black/20 rounded-lg p-3 space-y-2 flex-1 flex flex-col">
                            <h3 className="text-lg font-bold">2. Dữ liệu Khuôn mẫu</h3>
                            <label className="text-sm text-gray-400 mt-2">Tên Khuôn mẫu</label>
                            <input
                                type="text"
                                placeholder="Tên khuôn mẫu, ví dụ: 'T-Shirt Đen Biến thể'"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none"
                            />
                            
                            <label className="text-sm text-gray-400 mt-2">Description Template</label>
                            <Select value={selectedDescTemplateId} onChange={e => setSelectedDescTemplateId(e.target.value)}>
                                <option value="">— Use Custom/Fetched Description —</option>
                                {descriptionTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                            <TextArea
                                readOnly
                                value={templateDescription}
                                className="h-24 mt-1 bg-black/30 text-gray-400"
                            />

                            <label className="text-sm text-gray-400 mt-2">Inventory (JSON)</label>
                            <TextArea
                                placeholder="Dữ liệu JSON cho inventory/variants..."
                                value={templateInventory}
                                onChange={e => setTemplateInventory(e.target.value)}
                                className="h-20 font-mono text-xs"
                            />

                            <div className="grid grid-cols-3 gap-2 mt-2">
                                <div>
                                    <label className="text-sm text-gray-400">Taxonomy ID*</label>
                                    <input type="text" value={templateTaxonomyId} onChange={e => setTemplateTaxonomyId(e.target.value)} className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Shipping ID*</label>
                                    <input type="text" value={templateShippingId} onChange={e => setTemplateShippingId(e.target.value)} className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Return ID</label>
                                    <input type="text" value={templateReturnId} onChange={e => setTemplateReturnId(e.target.value)} className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Who Made*</label>
                                    <Select value={templateWhoMade} onChange={e => setTemplateWhoMade(e.target.value)} className="text-sm !p-2">
                                        <option value="i_did">I did</option>
                                        <option value="someone_else">Someone else</option>
                                        <option value="collective">A collective</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">When Made*</label>
                                    <Select value={templateWhenMade} onChange={e => setTemplateWhenMade(e.target.value)} className="text-sm !p-2">
                                        <option value="made_to_order">Made to order</option>
                                        <option value="2020_2024">2020-2024</option>
                                        <option value="2010_2019">2010-2019</option>
                                        <option value="2000_2009">2000-2009</option>
                                        <option value="before_2000">Before 2000</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Processing ID</label>
                                    <input type="text" placeholder="e.g., profile ID" value={templateReadinessId} onChange={e => setTemplateReadinessId(e.target.value)} className="w-full p-2 rounded-lg border border-white/20 bg-black/20 text-gray-200 outline-none text-sm" />
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-auto pt-3">
                                <Button variant="ghost" onClick={handleSaveTemplate} disabled={isSaving}>
                                    {isSaving ? "Đang lưu..." : "Lưu Khuôn mẫu"}
                                </Button>
                                <Button variant="warn" onClick={handleDeleteTemplate} disabled={!selectedTemplateId}>
                                    Xóa
                                </Button>
                                <Button variant="ghost" onClick={handleClearForm} className="ml-auto">
                                    Mới
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* --- CỘT BÊN PHẢI: UPLOAD --- */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-bold">3. Dữ liệu Upload</h3>
                        
                        <div className="bg-black/20 rounded-lg p-3 space-y-3 flex flex-col flex-1 min-h-0">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-gray-300">Ảnh Mockup ({mockups.length})</h4>
                                <div className="flex gap-2">
                                    <Button variant="ghost" className="!text-xs !py-1 !px-2" onClick={handleAddMockupsFromFile}>Add</Button>
                                    <Button variant="ghost" className="!text-xs !py-1 !px-2" onClick={handlePasteMockup}>Paste</Button>
                                </div>
                            </div>

                            <div className="flex-1 bg-black/20 rounded-lg p-2 text-center overflow-y-auto min-h-[120px]">
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
                                        <p className="text-sm text-gray-500">Chưa có Mockup nào.</p>
                                    </div>
                                )}
                            </div>

                            <h4 className="font-semibold text-gray-300">Title (Từ Cột 3)</h4>
                            <input
                                type="text"
                                value={generatedTitle}
                                readOnly
                                className="w-full p-2 rounded-lg border border-white/20 bg-black/30 text-gray-400 outline-none"
                            />

                            <h4 className="font-semibold text-gray-300">Tags (Từ Cột 3)</h4>
                            <input
                                type="text"
                                value={generatedTags.join(', ')}
                                readOnly
                                className="w-full p-2 rounded-lg border border-white/20 bg-black/30 text-gray-400 outline-none"
                            />

                            <div className="pt-3 border-t border-white/10 mt-auto">
                                <Button 
                                    variant="primary" 
                                    onClick={handleUploadToEtsy} 
                                    className="w-full py-3"
                                    disabled={isUploading || mockups.length === 0 || !generatedTitle || !selectedTemplateId}
                                >
                                    {isUploading ? <><Spinner className="mr-2"/> ĐANG UPLOAD...</> : 'XÁC NHẬN UPLOAD LÊN ETSY'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default EtsyUploadModal;