import React from 'react';

type Tab = 'art' | 'mockup' | 'etsy';

interface TabBarProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
}

const ArtIcon: React.FC<{isActive: boolean}> = ({isActive}) => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h8a2 2 0 002-2v-4a2 2 0 00-2-2h-8a2 2 0 00-2 2v4a2 2 0 002 2z" />
    </svg>
);

const EtsyIcon: React.FC<{isActive: boolean}> = ({isActive}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 8V5a2 2 0 012-2z" />
    </svg>
);

const MockupIcon: React.FC<{isActive: boolean}> = ({isActive}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
    const tabs: { id: Tab, label: string, icon: React.FC<{isActive: boolean}> }[] = [
        { id: 'art', label: 'Art', icon: ArtIcon },
        { id: 'mockup', label: 'Mockups', icon: MockupIcon },
        { id: 'etsy', label: 'Etsy', icon: EtsyIcon },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#0d0c1c]/80 border-t border-white/10 backdrop-blur-lg flex justify-around items-center md:hidden z-50">
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
                            isActive ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <tab.icon isActive={isActive} />
                        <span className="text-xs font-medium">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default TabBar;