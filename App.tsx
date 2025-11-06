import React, { useState, useRef, useContext, useEffect } from 'react';
import { ExpandedNode, User, LogEntry, MockupPrompt, ArtRef, Sample, Status, Job } from './types';
import ArtColumn from './components/ArtColumn';
import MockupColumn from './components/MockupColumn';
import EtsyColumn from './components/EtsyColumn';
import Header from './components/Header';
import StatusToast from './components/StatusToast';
import ImageViewer from './components/ImageViewer';
import ExpandedNodeComponent from './components/viewer/ExpandedNode';
import SettingsModal from './components/SettingsModal';
import ImageLogModal from './components/ImageLogModal';
import { Sparkle, SparkleInstance } from './components/common/Sparkle';
import * as geminiService from './services/geminiService';
import { downscaleDataUrl, downloadDataUrl, processImageForDownload, ProcessImageOptions } from './utils/fileUtils';
import { EXPAND_PROMPT_DEFAULT } from './constants';
import { AuthContext } from './contexts/AuthContext';
import { useImageLog } from './hooks/useImageLog';
import { useApiKeys } from './hooks/useApiKeys';
import ConnectionLines from './components/viewer/ConnectionLines';
import ImageEditor from './components/ImageEditor';
import TabBar from './components/TabBar';
import QueueManagerModal from './components/QueueManagerModal';
import AnnouncementBanner from './components/AnnouncementBanner';


const App: React.FC = () => {
    const [artwork, setArtwork] = useState<string | null>(null);
    const [previews, setPreviews] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [artRefs, setArtRefs] = useState<ArtRef[]>([]);
    const [samples, setSamples] = useState<Sample[]>([]);
    const [currentMockups, setCurrentMockups] = useState<LogEntry[]>([]);
    const [selectedMockupForEtsy, setSelectedMockupForEtsy] = useState<LogEntry | null>(null);

    // State for Etsy Column, lifted up for automation
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [generatedTags, setGeneratedTags] = useState<string[]>([]);
    const [isEtsyLoading, setIsEtsyLoading] = useState(false);


    const auth = useContext(AuthContext);
    const { log: generationLog, addResultToLog, deleteResultsFromLog } = useImageLog(auth.user);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
    const [status, setStatus] = useState<Status>({ message: '', type: 'info', visible: false });

    const [viewerData, setViewerData] = useState<{
        imageUrl: string;
        sourceId: string;
        sourceEl: HTMLElement;
    } | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<ExpandedNode[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isImageLogOpen, setIsImageLogOpen] = useState(false);
    const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
    const [isUpscaled, setIsUpscaled] = useState(false);
    const [isJpegCompress, setIsJpegCompress] = useState(false);
    const [jpegQuality, setJpegQuality] = useState('85');
    
    // Batch Mode State
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [jobQueue, setJobQueue] = useState<Job[]>([]);
    const [isQueueManagerOpen, setIsQueueManagerOpen] = useState(false);

    const sparkleRef = useRef<SparkleInstance>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { apiKeys } = useApiKeys(auth.user);

    const userApiKey = apiKeys.find(k => k.id === auth.user?.apiKeyId)?.key;

    const [activeTab, setActiveTab] = useState<'art' | 'mockup' | 'etsy'>('art');

    const getDownloadOptions = (): ProcessImageOptions => ({
        isUpscaled,
        isJpegCompress,
        jpegQuality: parseFloat(jpegQuality) || 85,
    });

    const showStatus = (message: string, type: Status['type'] = 'info', duration = 3000) => {
        setStatus({ message, type, visible: true });
        setTimeout(() => setStatus(s => ({ ...s, visible: false })), duration);
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(false);
        setProgress({ done: 0, total: 0, label: '' });
        showStatus('Generation cancelled', 'warn');
    };

    const handleGenerateArt = async (prompt: string, count: number, aspectRatio: string) => {
        if (!userApiKey) {
            showStatus('Your account does not have an API key assigned.', 'err');
            return;
        }
        setIsLoading(true);
        setPreviews([]);
        setCurrentIndex(0);
        showStatus(`Generating ${count} artwork(s)...`, 'info');
        
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        try {
            const refUrls = await Promise.all(artRefs.map(r => downscaleDataUrl(r.dataUrl)));
            
            const generatedImages = await geminiService.generateArtwork(prompt, aspectRatio, refUrls, count, userApiKey);
    
            if (signal.aborted) {
                throw new Error("Operation cancelled by user.");
            }
    
            setPreviews(generatedImages);
    
            for (let i = 0; i < generatedImages.length; i++) {
                const url = generatedImages[i];
                await addResultToLog({
                    id: `art-${Date.now()}-${i}`,
                    type: 'artwork',
                    prompt,
                    dataUrl: url,
                    createdAt: Date.now()
                });
            }
    
            showStatus(`Generated ${generatedImages.length} artwork(s)!`, 'ok');
        } catch (error: any) {
            console.error('Artwork generation failed:', error);
            if (error.message.includes("cancelled by user")) {
                showStatus('Artwork generation cancelled', 'warn');
            } else {
                showStatus(error.message || 'Artwork generation failed', 'err');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleApplyArtwork = (b64: string) => {
        setArtwork(b64);
        setPreviews([]);
        setCurrentIndex(0);
        setSelectedMockupForEtsy(null);
        setGeneratedTitle('');
        setGeneratedTags([]);
        showStatus('Artwork applied!', 'ok');
    };

    const handleGenerateEtsyContent = async (mockupToUse: LogEntry | null) => {
        if (!mockupToUse?.dataUrl || !mockupToUse.prompt) {
            showStatus('An eligible mockup with a prompt is required.', 'warn');
            return;
        }
        if (!userApiKey) {
            showStatus('Your account does not have an API key assigned.', 'err');
            return;
        }

        const fullPrompt = `${mockupToUse.prompt}; help me write a title in a way that follows Etsy’s updated title guidance (clear nouns, objective descriptors, no subjective/gifting words, no repeats) and 13 SEO tags (each under 20 characters, separated by commas).`;

        setIsEtsyLoading(true);
        setGeneratedTitle('');
        setGeneratedTags([]);
        try {
            const result = await geminiService.generateEtsyListing(fullPrompt, mockupToUse.dataUrl, userApiKey);
            setGeneratedTitle(result.title);
            setGeneratedTags(result.tags);
            showStatus('Title and tags generated!', 'ok');
        } catch (error: any) {
            console.error('Etsy generation failed:', error);
            showStatus(error.message || 'Failed to generate title and tags.', 'err');
        } finally {
            setIsEtsyLoading(false);
        }
    };

    const handleGenerateMockups = async (prompts: MockupPrompt[], count: number, aspectRatio: string) => {
        if (!artwork) {
            showStatus('Please apply an artwork first.', 'err');
            return;
        }
        if (!userApiKey) {
            showStatus('Your account does not have an API key assigned.', 'err');
            return;
        }
    
        setCurrentMockups([]);
        setSelectedMockupForEtsy(null);
        setGeneratedTitle('');
        setGeneratedTags([]);
        setIsLoading(true);
        const totalJobs = prompts.length * count;
        setProgress({ done: 0, total: totalJobs, label: 'Generating mockups...' });
        
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;
    
        try {
            const downscaledArtwork = await downscaleDataUrl(artwork);
            const downscaledSamples = await Promise.all(samples.map(s => downscaleDataUrl(s.dataUrl)));
    
            let jobsCompleted = 0;
            let firstMockupGenerated = false;
            for (const prompt of prompts) {
                for (let i = 0; i < count; i++) {
                    if (signal.aborted) {
                        throw new Error("Operation cancelled by user.");
                    }
                    
                    const resultId = `${prompt.id}-${i}-${Date.now()}`;
                    
                    try {
                        const resultUrl = await geminiService.generateMockup(prompt.prompt, aspectRatio, downscaledSamples, downscaledArtwork, userApiKey);
                        if (signal.aborted) throw new Error("Operation cancelled by user.");
                        const newEntry: LogEntry = { id: resultId, type: 'mockup', prompt: prompt.prompt, dataUrl: resultUrl, createdAt: Date.now() };
                        await addResultToLog(newEntry);
                        setCurrentMockups(prev => [newEntry, ...prev]);

                        if (!firstMockupGenerated) {
                            setSelectedMockupForEtsy(newEntry);
                            handleGenerateEtsyContent(newEntry); // Fire-and-forget
                            firstMockupGenerated = true;
                        }

                    } catch (error: any) {
                        if (signal.aborted) throw new Error("Operation cancelled by user.");
                        const newEntry: LogEntry = { id: resultId, type: 'mockup', prompt: prompt.prompt, dataUrl: '', error: error.message || 'Generation failed', createdAt: Date.now() };
                        await addResultToLog(newEntry);
                        setCurrentMockups(prev => [newEntry, ...prev]);
                    } finally {
                        if (!signal.aborted) {
                            jobsCompleted++;
                            setProgress(p => ({ ...p, done: jobsCompleted }));
                        }
                    }
                }
            }
    
            if (!signal.aborted) {
                showStatus(`Finished generating ${totalJobs} mockups.`, 'ok');
            }
        } catch (error: any) {
             if (error.message.includes("cancelled by user")) {
                showStatus('Mockup generation cancelled', 'warn');
            } else {
                console.error('Mockup generation failed:', error);
                showStatus(error.message || 'Mockup generation failed', 'err');
            }
        } finally {
            setIsLoading(false);
            setProgress({ done: 0, total: 0, label: '' });
        }
    };

    const handleAddToQueue = (prompts: MockupPrompt[], count: number, aspectRatio: string, sku: string) => {
        if (!artwork) {
            showStatus('Please apply an artwork first.', 'err');
            return;
        }

        const newJob: Job = {
            id: `job-${Date.now()}`,
            sku,
            artworkUrl: artwork,
            prompts,
            count,
            aspectRatio,
            status: 'queued',
            progress: { done: 0, total: prompts.length * count },
            results: [],
            createdAt: Date.now(),
        };

        setJobQueue(prev => [...prev, newJob]);
        showStatus(`Added ${newJob.progress.total} task(s) for SKU '${sku || 'Untitled'}' to the queue.`, 'ok');
    };

    // Effect to process the job queue
    useEffect(() => {
        if (isLoading || !isBatchMode) {
            return; // A job is already running or batch mode is off
        }

        const nextJob = jobQueue.find(j => j.status === 'queued');
        if (nextJob) {
            setIsLoading(true); // Set global loading lock

            setJobQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, status: 'running' } : j));
            
            abortControllerRef.current = new AbortController();
            const { signal } = abortControllerRef.current;
            
            const runGeneration = async () => {
                 try {
                    const downscaledArtwork = await downscaleDataUrl(nextJob.artworkUrl);
                    const downscaledSamples = await Promise.all(samples.map(s => downscaleDataUrl(s.dataUrl)));
            
                    let jobsCompleted = 0;
                    for (const prompt of nextJob.prompts) {
                        for (let i = 0; i < nextJob.count; i++) {
                            if (signal.aborted) throw new Error("Operation cancelled by user.");
                            
                            const resultId = `${prompt.id}-${i}-${Date.now()}`;
                            
                            try {
                                const resultUrl = await geminiService.generateMockup(prompt.prompt, nextJob.aspectRatio, downscaledSamples, downscaledArtwork, userApiKey!);
                                if (signal.aborted) throw new Error("Operation cancelled by user.");
                                const newEntry: LogEntry = { id: resultId, type: 'mockup', prompt: prompt.prompt, dataUrl: resultUrl, createdAt: Date.now() };
                                await addResultToLog(newEntry);
                                setJobQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, results: [...j.results, newEntry] } : j));

                            } catch (error: any) {
                                if (signal.aborted) throw new Error("Operation cancelled by user.");
                                 const newEntry: LogEntry = { id: resultId, type: 'mockup', prompt: prompt.prompt, dataUrl: '', error: error.message || 'Generation failed', createdAt: Date.now() };
                                 await addResultToLog(newEntry);
                                 setJobQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, results: [...j.results, newEntry] } : j));
                            } finally {
                                if (!signal.aborted) {
                                    jobsCompleted++;
                                    setJobQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, progress: {...j.progress, done: jobsCompleted} } : j));
                                }
                            }
                        }
                    }
                    
                    if (!signal.aborted) {
                        let finalResults: LogEntry[] = [];
                        setJobQueue(prev => {
                            const updatedJobs = prev.map(j => {
                                if (j.id === nextJob.id) {
                                    finalResults = j.results; // Grab results from the freshest state
                                    // FIX: Explicitly cast the status to its literal type to prevent type widening by TypeScript.
                                    return { ...j, status: 'completed' as const };
                                }
                                return j;
                            });
                            return updatedJobs;
                        });
                        setCurrentMockups(prev => [...finalResults, ...prev]);
                    }
                } catch (error: any) {
                     if (error.message.includes("cancelled by user")) {
                        setJobQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, status: 'cancelled' as const } : j));
                     } else {
                        setJobQueue(prev => prev.map(j => j.id === nextJob.id ? { ...j, status: 'error' as const, error: error.message } : j));
                     }
                } finally {
                    setIsLoading(false); // Release the lock to allow the next job to start
                }
            };
            runGeneration();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobQueue, isLoading, isBatchMode]);

    const handleCancelJob = (jobId: string) => {
        const jobToCancel = jobQueue.find(j => j.id === jobId);
        if (!jobToCancel) return;

        if (jobToCancel.status === 'running') {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort(); // This will trigger the catch block in runGeneration
            }
        } else if (jobToCancel.status === 'queued') {
            setJobQueue(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
        }
    };

    const handleClearCompletedJobs = () => {
        setJobQueue(prev => prev.filter(j => j.status === 'queued' || j.status === 'running'));
        showStatus('Cleared completed jobs from the list.', 'ok');
    };

    const handleExpandImage = async (source: { id: string; dataUrl: string }, ratio: string, sourceEl: HTMLElement) => {
        if (!userApiKey) {
            showStatus('Your account does not have an API key assigned.', 'err');
            return;
        }
        showStatus('Expanding image...', 'info');
        try {
            const downscaledSource = await downscaleDataUrl(source.dataUrl);
            const [expandedUrl] = await geminiService.generateArtwork(EXPAND_PROMPT_DEFAULT, ratio, [downscaledSource], 1, userApiKey);
            const rect = sourceEl.getBoundingClientRect();
            
            const newNode: ExpandedNode = {
                id: `expand-${Date.now()}`,
                sourceId: source.id,
                dataUrl: expandedUrl,
                ratioLabel: ratio,
                position: { x: rect.right - 420, y: rect.top - 50 },
            };
            setExpandedNodes(prev => [...prev, newNode]);
            sparkleRef.current?.burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
            showStatus('Image expanded!', 'ok');
        } catch (error: any) {
            showStatus(error.message || 'Failed to expand image', 'err');
        }
    };

    const handleNodePositionChange = (id: string, pos: { x: number; y: number }) => {
        setExpandedNodes(nodes => nodes.map(n => n.id === id ? { ...n, position: pos } : n));
    };

    const handleCloseNode = (id: string) => {
        setExpandedNodes(nodes => nodes.filter(n => n.id !== id));
    };

    const handleSaveAllExpanded = async () => {
        if (expandedNodes.length === 0) {
            showStatus('No expanded images to save.', 'info');
            return;
        }
    
        showStatus(`Saving ${expandedNodes.length} expanded image(s)...`, 'info');
        let savedCount = 0;
        try {
            const options = getDownloadOptions();
            for (const node of expandedNodes) {
                const { dataUrl: dataToSave, extension } = await processImageForDownload(node.dataUrl, options);
                downloadDataUrl(dataToSave, `expanded-${node.ratioLabel}-${node.id.slice(-6)}.${extension}`);
                savedCount++;
                await new Promise(res => setTimeout(res, 200));
            }
            showStatus(`Successfully saved ${savedCount} expanded image(s).`, 'ok');
        } catch (error: any) {
            showStatus(`Failed to save all expanded images: ${error.message}`, 'err');
        }
    };
    
    const handleDownloadImage = async (url: string, filename: string) => {
        sparkleRef.current?.burst(window.innerWidth / 2, window.innerHeight - 50, 15);
        const options = getDownloadOptions();
        const { dataUrl: dataToSave, extension } = await processImageForDownload(url, options);
        const baseFilename = filename.replace(/\.(png|jpg|jpeg)$/i, '');
        downloadDataUrl(dataToSave, `${baseFilename}.${extension}`);
        showStatus('Downloaded!', 'ok', 2000);
    };

    return (
        <div className="w-screen h-screen bg-[#0d0c1c] text-white flex flex-col font-sans overflow-hidden">
            <Sparkle ref={sparkleRef} />
            <Header 
                onSettingsClick={() => setIsSettingsOpen(true)} 
                onImageLogClick={() => setIsImageLogOpen(true)}
                onImageEditorClick={() => setIsImageEditorOpen(true)}
            />
            <AnnouncementBanner />
            <StatusToast status={status} />
            <ImageViewer
                isOpen={!!viewerData}
                imageUrl={viewerData?.imageUrl ?? null}
                onClose={() => setViewerData(null)}
                onDownload={() => viewerData && handleDownloadImage(viewerData.imageUrl, `${viewerData.sourceId}.png`)}
                onExpand={(ratio) => {
                    if (viewerData) {
                        handleExpandImage({ id: viewerData.sourceId, dataUrl: viewerData.imageUrl }, ratio, viewerData.sourceEl);
                    }
                    setViewerData(null);
                }}
            />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <ImageLogModal 
                isOpen={isImageLogOpen} 
                onClose={() => setIsImageLogOpen(false)}
                results={generationLog}
                onDelete={deleteResultsFromLog}
                showStatus={showStatus}
                user={auth.user}
                allUsers={auth.users}
                isUpscaled={isUpscaled}
                isJpegCompress={isJpegCompress}
                jpegQuality={jpegQuality}
            />
            <ImageEditor
                isOpen={isImageEditorOpen}
                onClose={() => setIsImageEditorOpen(false)}
                showStatus={showStatus}
                user={auth.user}
            />
            <QueueManagerModal
                isOpen={isQueueManagerOpen}
                onClose={() => setIsQueueManagerOpen(false)}
                jobs={jobQueue}
                onCancelJob={handleCancelJob}
                onClearCompleted={handleClearCompletedJobs}
                isUpscaled={isUpscaled}
                isJpegCompress={isJpegCompress}
                jpegQuality={jpegQuality}
            />
            
            <main className="flex-1 md:grid md:grid-cols-[1fr_1.2fr_1fr] md:grid-rows-1 gap-3 p-3 min-h-0 pb-16 md:pb-3">
                <div className={`md:block h-full ${activeTab === 'art' ? 'block' : 'hidden'}`}>
                    <ArtColumn
                        artwork={artwork}
                        previews={previews}
                        currentIndex={currentIndex}
                        onCurrentIndexChange={setCurrentIndex}
                        onArtworkApply={handleApplyArtwork}
                        artRefs={artRefs}
                        onArtRefsChange={setArtRefs}
                        samples={samples}
                        onSamplesChange={setSamples}
                        isLoading={isLoading && progress.total === 0 && !isBatchMode}
                        onGenerate={handleGenerateArt}
                        onCancel={handleCancel}
                        user={auth.user}
                        onViewImage={(imageUrl, sourceId, sourceEl) => setViewerData({ imageUrl, sourceId, sourceEl })}
                        sparkleRef={sparkleRef}
                        isUpscaled={isUpscaled}
                    />
                </div>
                 <div className={`md:block h-full ${activeTab === 'mockup' ? 'block' : 'hidden'}`}>
                    <MockupColumn
                        isLoading={isLoading && !isBatchMode}
                        progress={progress}
                        results={currentMockups}
                        onGenerate={handleGenerateMockups}
                        onCancel={handleCancel}
                        onViewImage={(result, sourceEl) => result.dataUrl && setViewerData({ imageUrl: result.dataUrl, sourceId: `mockup-${result.id}`, sourceEl })}
                        isUpscaled={isUpscaled}
                        onUpscaleChange={setIsUpscaled}
                        isJpegCompress={isJpegCompress}
                        onJpegCompressChange={setIsJpegCompress}
                        jpegQuality={jpegQuality}
                        onJpegQualityChange={setJpegQuality}
                        onSaveAllExpanded={handleSaveAllExpanded}
                        user={auth.user}
                        isBatchMode={isBatchMode}
                        onBatchModeChange={setIsBatchMode}
                        onAddToQueue={handleAddToQueue}
                        jobQueue={jobQueue}
                        onOpenQueueManager={() => setIsQueueManagerOpen(true)}
                        onSelectForEtsy={setSelectedMockupForEtsy}
                        selectedForEtsyId={selectedMockupForEtsy?.id}
                    />
                </div>
                 <div className={`md:block h-full ${activeTab === 'etsy' ? 'block' : 'hidden'}`}>
                    <EtsyColumn 
                        selectedMockup={selectedMockupForEtsy}
                        user={auth.user}
                        showStatus={showStatus}
                        onGenerate={handleGenerateEtsyContent}
                        generatedTitle={generatedTitle}
                        generatedTags={generatedTags}
                        isLoading={isEtsyLoading}
                    />
                </div>
            </main>
            
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="absolute inset-0 pointer-events-none z-40">
                <ConnectionLines nodes={expandedNodes} />
                {expandedNodes.map(node => (
                    <ExpandedNodeComponent
                        key={node.id}
                        node={node}
                        onClose={handleCloseNode}
                        onPositionChange={handleNodePositionChange}
                        onViewImage={(imageUrl) => {
                            const el = document.getElementById(`expanded-node-${node.id}`);
                            if(el) setViewerData({ imageUrl, sourceId: node.id, sourceEl: el });
                        }}
                        sparkleRef={sparkleRef}
                        isUpscaled={isUpscaled}
                        isJpegCompress={isJpegCompress}
                        jpegQuality={jpegQuality}
                    />
                ))}
            </div>
        </div>
    );
};

export default App;