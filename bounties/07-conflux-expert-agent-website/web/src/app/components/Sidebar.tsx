'use client';

interface SidebarProps {
    activeChat: number;
    onChatSelect: (id: number) => void;
    isOpen: boolean;
    onToggle: () => void;
}

// const historyItems = {
//     today: [
//         { id: 1, text: 'Conflux Network Overview' },
//         { id: 2, text: 'eSpace vs Core Space' },
//         { id: 3, text: 'Smart Contract Deployment' }
//     ],
//     yesterday: [
//         { id: 4, text: 'CFX Token Utilities' },
//         { id: 5, text: 'Running a Conflux Node' },
//         { id: 6, text: 'PoW + PoS Consensus' }
//     ],
//     previous: [
//         { id: 7, text: 'Wallet Integration Guide' },
//         { id: 8, text: 'Transaction Types' },
//         { id: 9, text: 'Gas Fees Explained' }
//     ]
// };

import { PanelLeftCloseIcon } from './Icons';

export default function Sidebar({ activeChat, onChatSelect, isOpen, onToggle }: SidebarProps) {
    return (
        <nav className={`sidebar ${!isOpen ? 'closed' : ''}`}>
            <div className="sidebar-header">
                <div className="brand-area">
                    <div className="brand-icon">C</div>
                    <div className="brand-text">Confluxpedia</div>
                </div>
                <button
                    className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                    onClick={onToggle}
                    aria-label="Close Sidebar"
                >
                    <PanelLeftCloseIcon />
                </button>
            </div>

            <div className="history-list">

            </div>
        </nav>
    );
}
