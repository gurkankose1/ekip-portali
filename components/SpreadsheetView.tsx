import React, { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../firebaseConfig.ts';
import { ref, onValue, set, remove, push, update, onDisconnect } from 'firebase/database';
import { GoogleGenAI, Type } from '@google/genai';
import { BoldIcon, ItalicIcon, UnderlineIcon, PlusCircleIcon, BorderAllIcon, UndoIcon, RedoIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, BorderNoneIcon, ZapIcon, Trash2Icon, FileTextIcon } from './Icons.tsx';
import { User } from '../types.ts';
import { Modal } from './Modal.tsx';

// --- Types ---
interface SpreadsheetViewProps {
    currentUser: User;
}
interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    border?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
}
interface CellModificationLog {
    timestamp: number;
    username: string;
    value: string; // new value (formula or plain)
}
interface CellData {
    value?: string;
    formula?: string;
    style?: CellStyle;
    history?: CellModificationLog[];
}
interface SheetInfo {
    id: string;
    name: string;
}
interface SheetConfig {
    colWidths?: { [key: number]: number };
    rowHeights?: { [key: number]: number };
}
interface HistoryEntry {
    gridData: CellData[][];
    sheetConfig: SheetConfig;
}
interface CursorData {
    row: number;
    col: number;
    username: string;
}

// --- Constants ---
const NUM_ROWS = 100;
const NUM_COLS = 26; // A-Z
const SPREADSHEET_DB_ROOT = 'spreadsheetData';
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 32;
const BORDER_STYLE = '1px solid #64748b'; // slate-500

// --- Helper Functions ---
const colToLetter = (colIndex: number): string => String.fromCharCode(65 + colIndex);
const letterToCol = (letter: string): number => letter.toUpperCase().charCodeAt(0) - 65;

const nameToColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; 
    }
    const color = Math.abs(hash).toString(16).substring(0, 6);
    return "#" + '000000'.substring(0, 6 - color.length) + color;
};

const parseCellId = (id: string): { row: number, col: number } | null => {
    const match = id.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    return { col: letterToCol(match[1]), row: parseInt(match[2], 10) - 1 };
};

const evaluateFormula = (formula: string, grid: CellData[][], visited: Set<string> = new Set()): string => {
    if (!formula || !formula.startsWith('=')) return formula;
    const formulaBody = formula.substring(1);
    const cellRefRegex = /[A-Z]+\d+/g;
    const formulaWithValues = formulaBody.replace(cellRefRegex, (match) => {
        if (visited.has(match)) return '#REF!'; 
        const cellId = parseCellId(match);
        if (!cellId || cellId.row >= NUM_ROWS || cellId.col >= NUM_COLS) return '#REF!';
        const { row, col } = cellId;
        const cell = grid[row]?.[col];
        const newVisited = new Set(visited);
        newVisited.add(match.toUpperCase());
        const cellValue = cell?.formula 
            ? evaluateFormula(cell.formula, grid, newVisited) 
            : cell?.value || '0';
        if (cellValue.startsWith('#')) return '0';
        const numericValue = parseFloat(cellValue);
        return isNaN(numericValue) ? '0' : cellValue;
    });
    if (formulaWithValues.includes('#REF!')) return '#REF!';
    try {
        if (/[^0-9.+\-*/()\s]/.test(formulaWithValues)) return '#NAME?';
        const result = new Function('return ' + formulaWithValues)();
        return String(result);
    } catch (error) {
        return '#ERROR!';
    }
};

const recalculateGrid = (grid: CellData[][]): CellData[][] => {
    let newGrid = JSON.parse(JSON.stringify(grid));
    for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLS; c++) {
            if (newGrid[r]?.[c]?.formula) {
                 newGrid[r][c].value = evaluateFormula(newGrid[r][c].formula, newGrid);
            }
        }
    }
    return newGrid;
};

// --- Sub-components ---

const SpreadsheetToolbar: React.FC<{
    selectedCellStyle: CellStyle;
    onStyleChange: (style: Partial<CellStyle>) => void;
    onApplyBorders: (type: 'all' | 'none') => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onOpenAiModal: () => void;
}> = ({ selectedCellStyle, onStyleChange, onApplyBorders, onUndo, onRedo, canUndo, canRedo, onOpenAiModal }) => {
    const colorInputRef = useRef<HTMLInputElement>(null);
    const bgColorInputRef = useRef<HTMLInputElement>(null);

    const toggleStyle = (styleKey: keyof CellStyle) => {
        onStyleChange({ [styleKey]: !selectedCellStyle[styleKey] });
    };

    return (
        <div className="p-2 bg-slate-700/50 rounded-t-lg border-b border-slate-600 flex items-center gap-2 flex-shrink-0 z-20 flex-wrap">
            <button onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600" title="Geri Al (Ctrl+Z)"><UndoIcon className="w-4 h-4" /></button>
            <button onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600" title="Yinele (Ctrl+Y)"><RedoIcon className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <button onClick={() => toggleStyle('bold')} className={`p-1.5 rounded ${selectedCellStyle.bold ? 'bg-sky-600 text-white' : 'hover:bg-slate-600'}`}><BoldIcon className="w-4 h-4" /></button>
            <button onClick={() => toggleStyle('italic')} className={`p-1.5 rounded ${selectedCellStyle.italic ? 'bg-sky-600 text-white' : 'hover:bg-slate-600'}`}><ItalicIcon className="w-4 h-4" /></button>
            <button onClick={() => toggleStyle('underline')} className={`p-1.5 rounded ${selectedCellStyle.underline ? 'bg-sky-600 text-white' : 'hover:bg-slate-600'}`}><UnderlineIcon className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <button onClick={() => onApplyBorders('all')} className="p-1.5 rounded hover:bg-slate-600" title="Tüm Kenarlıklar (Ctrl+T)"><BorderAllIcon className="w-4 h-4" /></button>
            <button onClick={() => onApplyBorders('none')} className="p-1.5 rounded hover:bg-slate-600" title="Kenarlıkları Kaldır"><BorderNoneIcon className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <button onClick={() => onStyleChange({ textAlign: 'left' })} className={`p-1.5 rounded ${selectedCellStyle.textAlign === 'left' ? 'bg-sky-600 text-white' : 'hover:bg-slate-600'}`}><AlignLeftIcon className="w-4 h-4" /></button>
            <button onClick={() => onStyleChange({ textAlign: 'center' })} className={`p-1.5 rounded ${selectedCellStyle.textAlign === 'center' ? 'bg-sky-600 text-white' : 'hover:bg-slate-600'}`}><AlignCenterIcon className="w-4 h-4" /></button>
            <button onClick={() => onStyleChange({ textAlign: 'right' })} className={`p-1.5 rounded ${selectedCellStyle.textAlign === 'right' ? 'bg-sky-600 text-white' : 'hover:bg-slate-600'}`}><AlignRightIcon className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <div className="relative">
                <button onClick={() => colorInputRef.current?.click()} className="p-1.5 rounded hover:bg-slate-600" title="Yazı Rengi">
                    <div style={{ borderBottom: `4px solid ${selectedCellStyle.color || 'currentColor'}` }}>A</div>
                </button>
                <input ref={colorInputRef} type="color" value={selectedCellStyle.color || '#f8fafc'} onChange={e => onStyleChange({ color: e.target.value })} className="absolute top-0 left-0 w-0 h-0 opacity-0" />
            </div>
            <div className="relative">
                <button onClick={() => bgColorInputRef.current?.click()} className="p-1.5 rounded hover:bg-slate-600" title="Dolgu Rengi">
                    <div className="w-5 h-5 rounded-sm" style={{ backgroundColor: selectedCellStyle.backgroundColor || 'transparent', border: '1px solid #475569' }}></div>
                </button>
                <input ref={bgColorInputRef} type="color" value={selectedCellStyle.backgroundColor || '#1e293b'} onChange={e => onStyleChange({ backgroundColor: e.target.value })} className="absolute top-0 left-0 w-0 h-0 opacity-0" />
            </div>
            <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <button onClick={onOpenAiModal} className="p-1.5 rounded hover:bg-slate-600 flex items-center gap-1 text-amber-400" title="AI Asistanı">
                <ZapIcon className="w-4 h-4" />
                <span className="text-xs font-semibold">AI Asistan</span>
            </button>
        </div>
    );
};

const FxBar: React.FC<{ value: string; onChange: (newValue: string) => void; onCommit: () => void; }> = ({ value, onChange, onCommit }) => {
    return (
        <div className="p-2 bg-slate-700/50 border-b border-slate-600 flex items-center gap-2 flex-shrink-0 z-20">
            <div className="px-2 py-1 text-xs font-mono bg-slate-600 rounded-md text-sky-300">fx</div>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onCommit}
                onKeyDown={e => { if (e.key === 'Enter') { onCommit(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); } }}
                className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-mono"
            />
        </div>
    );
};

const SheetTabs: React.FC<{
    sheets: SheetInfo[];
    activeSheetId: string;
    onSelectSheet: (id: string) => void;
    onAddSheet: () => void;
    onRenameSheet: (id: string, newName: string) => void;
    onDeleteSheet: (id: string, name: string) => void;
    onContextMenu: (event: React.MouseEvent, sheet: SheetInfo) => void;
}> = ({ sheets, activeSheetId, onSelectSheet, onAddSheet, onRenameSheet, onDeleteSheet, onContextMenu }) => {
    const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const handleRenameStart = (sheet: SheetInfo) => {
        setRenamingSheet(sheet.id);
        setRenameValue(sheet.name);
    };

    const handleRenameConfirm = () => {
        if (renamingSheet && renameValue.trim()) {
            onRenameSheet(renamingSheet, renameValue.trim());
        }
        setRenamingSheet(null);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameConfirm();
        } else if (e.key === 'Escape') {
            setRenamingSheet(null);
        }
    };

    useEffect(() => {
        if (renamingSheet) {
            const input = document.getElementById(`rename-input-${renamingSheet}`);
            input?.focus();
        }
    }, [renamingSheet]);

    return (
        <div className="p-1 bg-slate-700/50 rounded-b-lg border-t border-slate-600 flex items-center gap-1 flex-shrink-0 z-20 overflow-x-auto">
            {sheets.map(sheet => (
                <div key={sheet.id} onContextMenu={(e) => onContextMenu(e, sheet)}>
                    {renamingSheet === sheet.id ? (
                        <input
                            id={`rename-input-${sheet.id}`}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleRenameConfirm}
                            onKeyDown={handleRenameKeyDown}
                            className="px-3 py-1 text-sm bg-slate-800 border border-sky-500 rounded-md text-slate-100 outline-none"
                        />
                    ) : (
                        <button
                            onClick={() => onSelectSheet(sheet.id)}
                            onDoubleClick={() => handleRenameStart(sheet)}
                            data-sheet-id={sheet.id}
                            className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${activeSheetId === sheet.id ? 'bg-sky-600 text-white font-semibold' : 'hover:bg-slate-600'}`}
                        >
                            {sheet.name}
                        </button>
                    )}
                </div>
            ))}
            <button onClick={onAddSheet} className="p-1.5 rounded-full hover:bg-slate-600 ml-2" title="Yeni Sayfa Ekle">
                <PlusCircleIcon className="w-5 h-5 text-sky-300" />
            </button>
        </div>
    );
};

const ContextMenu: React.FC<{
    x: number;
    y: number;
    onClose: () => void;
    onStyleChange: (style: Partial<CellStyle>) => void;
    selectedCellStyle: CellStyle;
    onClear: () => void;
    onShowLogs: () => void;
}> = ({ x, y, onClose, onStyleChange, selectedCellStyle, onClear, onShowLogs }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            style={{ top: y, left: x }}
            className="absolute z-50 bg-slate-800 border border-slate-600 rounded-md shadow-lg py-1 w-48"
        >
            <div className="flex justify-start p-1 border-b border-slate-700">
                <button onClick={() => { onStyleChange({ bold: !selectedCellStyle.bold }); onClose(); }} className={`p-1.5 rounded ${selectedCellStyle.bold ? 'bg-sky-600 text-white' : 'hover:bg-slate-700'}`}><BoldIcon className="w-4 h-4" /></button>
                <button onClick={() => { onStyleChange({ italic: !selectedCellStyle.italic }); onClose(); }} className={`p-1.5 rounded ${selectedCellStyle.italic ? 'bg-sky-600 text-white' : 'hover:bg-slate-700'}`}><ItalicIcon className="w-4 h-4" /></button>
                <button onClick={() => { onStyleChange({ underline: !selectedCellStyle.underline }); onClose(); }} className={`p-1.5 rounded ${selectedCellStyle.underline ? 'bg-sky-600 text-white' : 'hover:bg-slate-700'}`}><UnderlineIcon className="w-4 h-4" /></button>
            </div>
            <button onClick={onClear} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 flex items-center gap-2"><Trash2Icon className="w-4 h-4" /> Hücreleri Temizle</button>
            <button onClick={onShowLogs} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 flex items-center gap-2"><FileTextIcon className="w-4 h-4" /> Değişiklik Geçmişi</button>
        </div>
    );
};

// FIX: Added a new component to handle the context menu for sheet tabs.
const SheetContextMenu: React.FC<{
    x: number;
    y: number;
    sheet: SheetInfo;
    onClose: () => void;
    onDelete: () => void;
}> = ({ x, y, sheet, onClose, onDelete }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleRename = () => {
        onClose();
        const btn = document.querySelector(`button[data-sheet-id='${sheet.id}']`);
        if (btn instanceof HTMLElement) {
            btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
    };

    return (
        <div
            ref={menuRef}
            style={{ top: y, left: x }}
            className="absolute z-50 bg-slate-800 border border-slate-600 rounded-md shadow-lg py-1 w-48"
        >
            <button onClick={handleRename} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700">Yeniden Adlandır</button>
            <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 text-red-400">Sil</button>
        </div>
    );
};

const LogViewerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    logs: CellModificationLog[];
}> = ({ isOpen, onClose, logs }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Hücre Değişiklik Geçmişi">
        {logs.length > 0 ? (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
                {logs.map((log, index) => (
                    <li key={index} className="text-sm p-2 bg-slate-700/50 rounded-md">
                        <p className="font-semibold text-slate-200">"{log.value}"</p>
                        <p className="text-xs text-slate-400 mt-1">
                            <span className="font-bold text-amber-400">{log.username}</span> tarafından
                        </p>
                        <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('tr-TR')}</p>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-slate-400 text-center">Bu hücre için değişiklik kaydı bulunmuyor.</p>
        )}
    </Modal>
);

// --- Main Component ---
export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ currentUser }) => {
    const createEmptyGrid = () => Array(NUM_ROWS).fill(null).map(() => Array(NUM_COLS).fill({}));
    
    const [sheets, setSheets] = useState<SheetInfo[]>([]);
    const [activeSheetId, setActiveSheetId] = useState<string>('');
    const [gridData, setGridData] = useState<CellData[][]>(createEmptyGrid());
    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({});
    
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [selectionArea, setSelectionArea] = useState<{ start: { row: number, col: number }, end: { row: number, col: number } } | null>(null);
    const isMouseDownRef = useRef(false);

    const [history, setHistory] = useState<HistoryEntry[]>([{ gridData: createEmptyGrid(), sheetConfig: {} }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: number, col: number } | null>(null);
    const [sheetContextMenu, setSheetContextMenu] = useState<{ x: number, y: number, sheet: SheetInfo } | null>(null);

    const isUpdatingDbRef = useRef(false);
    const [resizingCol, setResizingCol] = useState<number | null>(null);
    const [resizingRow, setResizingRow] = useState<number | null>(null);
    
    const [activeCursors, setActiveCursors] = useState<CursorData[]>([]);
    const myCursorRef = useRef(null);

    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [cellLogs, setCellLogs] = useState<CellModificationLog[]>([]);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const ctrlKeyRef = useRef({ isDown: false, usedInCombo: false });


    // --- Data Initialization & Sync ---
    useEffect(() => {
        const sheetsRef = ref(database, `${SPREADSHEET_DB_ROOT}/_sheets`);
        const unsubscribe = onValue(sheetsRef, async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const loadedSheets: SheetInfo[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setSheets(loadedSheets);
                if (!activeSheetId && loadedSheets.length > 0) {
                    setActiveSheetId(loadedSheets[0].id);
                } else if (loadedSheets.length === 0) {
                    const newSheetRef = push(sheetsRef);
                    const newSheetId = newSheetRef.key!;
                    await set(newSheetRef, { name: 'Sayfa1' });
                    setActiveSheetId(newSheetId);
                }
            } else {
                const newSheetRef = push(sheetsRef);
                const newSheetId = newSheetRef.key!;
                await set(newSheetRef, { name: 'Sayfa1' });
                setActiveSheetId(newSheetId);
            }
        });
        return () => unsubscribe();
    }, []);

     useEffect(() => {
        if (!activeSheetId || !currentUser) return;

        const presenceRef = ref(database, `${SPREADSHEET_DB_ROOT}/${activeSheetId}/_presence`);
        myCursorRef.current = push(presenceRef);
        onDisconnect(myCursorRef.current).remove();

        const unsubscribe = onValue(presenceRef, (snapshot) => {
            const data = snapshot.val() || {};
            const cursors = Object.values(data) as CursorData[];
            setActiveCursors(cursors.filter(c => c.username !== currentUser.username));
        });

        return () => {
            if (myCursorRef.current) remove(myCursorRef.current);
            unsubscribe();
        }
    }, [activeSheetId, currentUser]);

     useEffect(() => {
        if (!activeSheetId) return;
        const dbRef = ref(database, `${SPREADSHEET_DB_ROOT}/${activeSheetId}`);
        const unsubscribe = onValue(dbRef, (snapshot) => {
            if (isUpdatingDbRef.current) { return; }
            const data = snapshot.val();
            if (data) {
                const loadedGrid = data.gridData || createEmptyGrid();
                const loadedConfig = data.sheetConfig || {};
                const recalculatedGrid = recalculateGrid(loadedGrid);
                setGridData(recalculatedGrid);
                setSheetConfig(loadedConfig);
                // Reset history only on external change, not self-inflicted ones.
                const isExternalChange = JSON.stringify(recalculatedGrid) !== JSON.stringify(history[historyIndex].gridData);
                if (isExternalChange) {
                    setHistory([{ gridData: recalculatedGrid, sheetConfig: loadedConfig }]);
                    setHistoryIndex(0);
                }
            }
        });
        return () => unsubscribe();
    }, [activeSheetId]);


    const updateDb = useCallback((newGrid: CellData[][], newConfig: SheetConfig) => {
        if (!activeSheetId) return;
        isUpdatingDbRef.current = true;
        const dbRef = ref(database, `${SPREADSHEET_DB_ROOT}/${activeSheetId}`);
        update(dbRef, { gridData: newGrid, sheetConfig: newConfig })
            .finally(() => {
                isUpdatingDbRef.current = false;
            });
    }, [activeSheetId]);


    // --- History Management ---
    const updateHistory = (newGrid: CellData[][], newConfig: SheetConfig) => {
        const newEntry = { gridData: newGrid, sheetConfig: newConfig };
        // Check if the new state is different from the last one to avoid duplicates
        if (JSON.stringify(newEntry) === JSON.stringify(history[historyIndex])) {
            return;
        }
        const newHistory = history.slice(0, historyIndex + 1);
        setHistory([...newHistory, newEntry]);
        setHistoryIndex(newHistory.length);
    };

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const prevState = history[newIndex];
            setGridData(prevState.gridData);
            setSheetConfig(prevState.sheetConfig);
            updateDb(prevState.gridData, prevState.sheetConfig);
        }
    }, [history, historyIndex, updateDb]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            const nextState = history[newIndex];
            setGridData(nextState.gridData);
            setSheetConfig(nextState.sheetConfig);
            updateDb(nextState.gridData, nextState.sheetConfig);
        }
    }, [history, historyIndex, updateDb]);

    // --- Cell & Selection Handlers ---
    const handleCellClick = useCallback((row: number, col: number, isShift: boolean) => {
        if (editingCell && editingCell.row === row && editingCell.col === col) return;
        setEditingCell(null);
        if (isShift && selectionArea) {
            setSelectionArea({ ...selectionArea, end: { row, col } });
        } else {
            setSelectedCell({ row, col });
            setSelectionArea({ start: { row, col }, end: { row, col } });
        }
        if(myCursorRef.current) set(myCursorRef.current, { row, col, username: currentUser.username });
        gridContainerRef.current?.focus();
    }, [editingCell, selectionArea, currentUser.username]);
    
    const handleCellDoubleClick = (row: number, col: number) => {
        setEditingCell({ row, col });
        const cell = gridData[row]?.[col];
        setEditValue(cell?.formula || cell?.value || '');
    };
    
    const handleCellChangeCommit = () => {
        if (!editingCell) return;
        const { row, col } = editingCell;
        const newGrid = JSON.parse(JSON.stringify(gridData));
        if (!newGrid[row]) newGrid[row] = [];
        const cell = newGrid[row][col] || {};
        const oldValue = cell.formula || cell.value || '';
        if (editValue === oldValue) {
            setEditingCell(null);
            return;
        }

        if (editValue.startsWith('=')) {
            cell.formula = editValue;
        } else {
            cell.value = editValue;
            delete cell.formula;
        }
        const log: CellModificationLog = { timestamp: Date.now(), username: currentUser.username, value: editValue };
        if (!cell.history) cell.history = [];
        cell.history.unshift(log);
        cell.history = cell.history.slice(0, 10);
        newGrid[row][col] = cell;

        const recalculatedGrid = recalculateGrid(newGrid);
        setGridData(recalculatedGrid);
        setEditingCell(null);
        updateHistory(recalculatedGrid, sheetConfig);
        updateDb(recalculatedGrid, sheetConfig);
    };
    
    const getSelectedCells = () => {
        const area = selectionArea || { start: selectedCell, end: selectedCell };
        const { start, end } = area;
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);
        const cells = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                cells.push({ row: r, col: c });
            }
        }
        return cells;
    };
    
    const handleMouseDown = (row: number, col: number, e: React.MouseEvent) => {
        // Only trigger selection change on left-click
        if (e.button !== 0) return;
        isMouseDownRef.current = true;
        setSelectionArea({ start: { row, col }, end: { row, col } });
        setSelectedCell({ row, col });
        if(myCursorRef.current) set(myCursorRef.current, { row, col, username: currentUser.username });
    };
    
    const handleMouseOver = (row: number, col: number) => {
        if (isMouseDownRef.current && selectionArea) {
            setSelectionArea({ ...selectionArea, end: { row, col } });
        }
    };
    
    const handleMouseUp = () => { isMouseDownRef.current = false; };
    
    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);
    
    const handleCellContextMenu = (e: React.MouseEvent, row: number, col: number) => {
        e.preventDefault();
        setSheetContextMenu(null); // Close other menu
        const selectedCells = getSelectedCells();
        const isCellInSelection = selectedCells.some(cell => cell.row === row && cell.col === col);
        if (!isCellInSelection) {
            setSelectedCell({row, col});
            setSelectionArea({ start: {row, col}, end: {row, col} });
        }
        setContextMenu({ x: e.clientX, y: e.clientY, row, col });
    };

    // --- Keyboard Handlers ---
    const handleBulkClear = () => {
        const newGrid = JSON.parse(JSON.stringify(gridData));
        const cellsToClear = getSelectedCells();
        cellsToClear.forEach(({ row, col }) => {
            if (!newGrid[row]) return;
            const cell = newGrid[row][col];
            if (cell && (cell.value || cell.formula)) {
                const log: CellModificationLog = { timestamp: Date.now(), username: currentUser.username, value: '' };
                if (!cell.history) cell.history = [];
                cell.history.unshift(log);
                cell.history = cell.history.slice(0, 10);
                delete cell.value;
                delete cell.formula;
            }
        });
        const recalculatedGrid = recalculateGrid(newGrid);
        setGridData(recalculatedGrid);
        updateHistory(recalculatedGrid, sheetConfig);
        updateDb(recalculatedGrid, sheetConfig);
    };

    const handleTimestampInsert = () => {
        const { row, col } = selectedCell;
        const newGrid = JSON.parse(JSON.stringify(gridData));
        if (!newGrid[row]) newGrid[row] = [];
        const cell = newGrid[row][col] || {};
        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        cell.value = timestamp;
        delete cell.formula;
        const log: CellModificationLog = { timestamp: Date.now(), username: currentUser.username, value: timestamp };
        if (!cell.history) cell.history = [];
        cell.history.unshift(log);
        cell.history = cell.history.slice(0, 10);
        newGrid[row][col] = cell;
        const recalculatedGrid = recalculateGrid(newGrid);
        setGridData(recalculatedGrid);
        updateHistory(recalculatedGrid, sheetConfig);
        updateDb(recalculatedGrid, sheetConfig);
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            if (ctrlKeyRef.current.isDown && !ctrlKeyRef.current.usedInCombo) {
                handleTimestampInsert();
            }
            ctrlKeyRef.current = { isDown: false, usedInCombo: false };
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Manage Ctrl key state for single press detection
        if (e.key === 'Control' || e.key === 'Meta') {
            if (!e.repeat) {
                ctrlKeyRef.current = { isDown: true, usedInCombo: false };
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Another key was pressed while Ctrl/Meta was down
            ctrlKeyRef.current.usedInCombo = true;
        }

        // Handle standard shortcuts
        if ((e.ctrlKey || e.metaKey) && !editingCell) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }
            if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }
            if (e.key.toLowerCase() === 't') {
                e.preventDefault();
                handleApplyBorders('all');
                return;
            }
        }
    
        if (editingCell) return;
        const { row, col } = selectedCell;
    
        // --- Navigation ---
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            e.preventDefault();
            let newRow = row;
            let newCol = col;
    
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    newCol--;
                    if (newCol < 0) {
                        newCol = NUM_COLS - 1;
                        newRow = Math.max(0, newRow - 1);
                    }
                } else {
                    newCol++;
                    if (newCol >= NUM_COLS) {
                        newCol = 0;
                        newRow = Math.min(NUM_ROWS - 1, newRow + 1);
                    }
                }
                handleCellClick(newRow, newCol, false);
            } else { // Arrow keys
                switch (e.key) {
                    case 'ArrowUp': newRow = Math.max(0, row - 1); break;
                    case 'ArrowDown': newRow = Math.min(NUM_ROWS - 1, row + 1); break;
                    case 'ArrowLeft': newCol = Math.max(0, col - 1); break;
                    case 'ArrowRight': newCol = Math.min(NUM_COLS - 1, col + 1); break;
                }
                handleCellClick(newRow, newCol, e.shiftKey);
            }
            return;
        }
    
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            handleBulkClear();
            return;
        }
    
        if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Enter' || e.key === 'F2')) {
            e.preventDefault();
            setEditingCell({ row, col });
            if (e.key.length === 1) {
                setEditValue(e.key);
            } else {
                const cell = gridData[row]?.[col];
                setEditValue(cell?.formula || cell?.value || '');
            }
        }
    };

    // --- Styling & Resizing ---
    const handleStyleChange = (style: Partial<CellStyle>) => {
        const newGrid = JSON.parse(JSON.stringify(gridData));
        getSelectedCells().forEach(({ row, col }) => {
            if (!newGrid[row]) newGrid[row] = [];
            if (!newGrid[row][col]) newGrid[row][col] = {};
            if (!newGrid[row][col].style) newGrid[row][col].style = {};
            Object.assign(newGrid[row][col].style, style);
        });
        setGridData(newGrid);
        updateHistory(newGrid, sheetConfig);
        updateDb(newGrid, sheetConfig);
    };

    const handleApplyBorders = (type: 'all' | 'none') => {
        const newGrid = JSON.parse(JSON.stringify(gridData));
        getSelectedCells().forEach(({ row, col }) => {
            if (!newGrid[row]) newGrid[row] = [];
            if (!newGrid[row][col]) newGrid[row][col] = {};
            if (!newGrid[row][col].style) newGrid[row][col].style = {};
            newGrid[row][col].style.border = type === 'all' 
                ? { top: BORDER_STYLE, right: BORDER_STYLE, bottom: BORDER_STYLE, left: BORDER_STYLE }
                : { top: 'none', right: 'none', bottom: 'none', left: 'none' };
        });
        setGridData(newGrid);
        updateHistory(newGrid, sheetConfig);
        updateDb(newGrid, sheetConfig);
    };
    
    const handleColResizeStart = (col: number, e: React.MouseEvent) => { e.preventDefault(); setResizingCol(col); };
    const handleRowResizeStart = (row: number, e: React.MouseEvent) => { e.preventDefault(); setResizingRow(row); };

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (resizingCol !== null) {
            const newWidths = { ...sheetConfig.colWidths };
            newWidths[resizingCol] = Math.max(30, (newWidths[resizingCol] || DEFAULT_COL_WIDTH) + e.movementX);
            setSheetConfig(prev => ({ ...prev, colWidths: newWidths }));
        }
        if (resizingRow !== null) {
            const newHeights = { ...sheetConfig.rowHeights };
            newHeights[resizingRow] = Math.max(20, (newHeights[resizingRow] || DEFAULT_ROW_HEIGHT) + e.movementY);
            setSheetConfig(prev => ({ ...prev, rowHeights: newHeights }));
        }
    }, [resizingCol, resizingRow, sheetConfig]);

    const handleResizeEnd = useCallback(() => {
        if (resizingCol !== null || resizingRow !== null) {
            updateHistory(gridData, sheetConfig);
            updateDb(gridData, sheetConfig);
        }
        setResizingCol(null);
        setResizingRow(null);
    }, [resizingCol, resizingRow, gridData, sheetConfig, updateDb]);

    useEffect(() => {
        if (resizingCol !== null || resizingRow !== null) {
            document.body.classList.add(resizingCol !== null ? 'resizing-col' : 'resizing-row');
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
        }
        return () => {
            document.body.classList.remove('resizing-col', 'resizing-row');
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [resizingCol, resizingRow, handleResizeMove, handleResizeEnd]);

    
    // --- Sheet Management ---
    const handleSheetContextMenu = (e: React.MouseEvent, sheet: SheetInfo) => {
        e.preventDefault();
        setContextMenu(null); // Close cell menu if open
        setSheetContextMenu({ x: e.clientX, y: e.clientY, sheet });
    };

    const handleAddSheet = async () => {
        const sheetsRef = ref(database, `${SPREADSHEET_DB_ROOT}/_sheets`);
        const newSheetRef = push(sheetsRef);
        await set(newSheetRef, { name: `Sayfa${sheets.length + 1}` });
        setActiveSheetId(newSheetRef.key!);
    };
    
    const handleSelectSheet = (id: string) => {
        setActiveSheetId(id);
        setHistory([{ gridData: createEmptyGrid(), sheetConfig: {} }]);
        setHistoryIndex(0);
        gridContainerRef.current?.focus();
    };

    const handleRenameSheet = (id: string, newName: string) => {
        const sheetRef = ref(database, `${SPREADSHEET_DB_ROOT}/_sheets/${id}`);
        update(sheetRef, { name: newName });
        setSheetContextMenu(null);
    };
    
    const handleDeleteSheet = (id: string, name: string) => {
        if (sheets.length <= 1) { alert("Son sayfayı silemezsiniz."); setSheetContextMenu(null); return; }
        if (window.confirm(`'${name}' sayfasını silmek istediğinizden emin misiniz?`)) {
            remove(ref(database, `${SPREADSHEET_DB_ROOT}/_sheets/${id}`));
            remove(ref(database, `${SPREADSHEET_DB_ROOT}/${id}`));
            if (activeSheetId === id) setActiveSheetId(sheets.find(s => s.id !== id)!.id);
        }
        setSheetContextMenu(null);
    };

    // --- AI Integration ---
    const handleAiSubmit = async () => {
        setIsAiLoading(true);
        try {
            const startCell = getSelectedCells()[0];
            const startCellId = `${colToLetter(startCell.col)}${startCell.row + 1}`;
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: aiPrompt,
                config: {
                    systemInstruction: `You are a spreadsheet assistant. The user wants to populate data starting from cell ${startCellId}. Provide the data in a JSON array of arrays format. For example: [["Header 1", "Header 2"], ["Data A1", "Data A2"], ["Data B1", "Data B2"]]. Do not add any extra text or markdown formatting.`,
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.OBJECT, properties: { data: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
                }
            });
            const result = JSON.parse(response.text.trim());
            if (Array.isArray(result.data)) {
                let newGrid = JSON.parse(JSON.stringify(gridData));
                result.data.forEach((row: any[], rOffset: number) => {
                    if (Array.isArray(row)) {
                        row.forEach((cellValue, cOffset) => {
                            const targetRow = startCell.row + rOffset;
                            const targetCol = startCell.col + cOffset;
                            if (targetRow < NUM_ROWS && targetCol < NUM_COLS) {
                                if (!newGrid[targetRow]) newGrid[targetRow] = [];
                                const currentCell = newGrid[targetRow][targetCol] || {};
                                newGrid[targetRow][targetCol] = { ...currentCell, value: String(cellValue) };
                            }
                        });
                    }
                });
                const recalculatedGrid = recalculateGrid(newGrid);
                setGridData(recalculatedGrid);
                updateHistory(recalculatedGrid, sheetConfig);
                updateDb(recalculatedGrid, sheetConfig);
                setIsAiModalOpen(false);
            }
        } catch (error) { console.error("AI Error:", error); alert("Yapay zeka asistanı bir hata ile karşılaştı."); } 
        finally { setIsAiLoading(false); }
    };
    
    // --- Render ---
    const selectedRangeStyle = (): CellStyle => {
        const cells = getSelectedCells();
        if (cells.length === 0) return {};
        let commonStyle: CellStyle = JSON.parse(JSON.stringify(gridData[cells[0].row]?.[cells[0].col]?.style || {}));
        for (let i = 1; i < cells.length; i++) {
            const cellStyle = gridData[cells[i].row]?.[cells[i].col]?.style || {};
            (Object.keys(commonStyle) as Array<keyof CellStyle>).forEach(key => {
                if(JSON.stringify(commonStyle[key]) !== JSON.stringify(cellStyle[key])) delete commonStyle[key];
            });
        }
        return commonStyle;
    };
    
    const activeCell = gridData[selectedCell.row]?.[selectedCell.col];
    const fxBarValue = editingCell ? editValue : (activeCell?.formula || activeCell?.value || '');

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] bg-slate-800 rounded-lg shadow-2xl border border-slate-700 animate-fade-in">
            <SpreadsheetToolbar selectedCellStyle={selectedRangeStyle()} onStyleChange={handleStyleChange} onApplyBorders={handleApplyBorders} onUndo={handleUndo} onRedo={handleRedo} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1} onOpenAiModal={() => setIsAiModalOpen(true)} />
            <FxBar value={fxBarValue} onChange={val => { setEditValue(val); if (!editingCell) setEditingCell(selectedCell); }} onCommit={handleCellChangeCommit} />
            <div ref={gridContainerRef} tabIndex={0} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} className="flex-grow w-full overflow-auto relative outline-none" onMouseUp={handleMouseUp}>
                <table className="table-fixed border-collapse bg-slate-800">
                    <thead>
                        <tr>
                            <th className="w-12 min-w-12 sticky top-0 left-0 z-20 bg-slate-700 border border-slate-600"></th>
                            {Array.from({ length: NUM_COLS }).map((_, c) => (
                                <th key={c} className="p-1 text-center text-xs font-mono select-none relative sticky top-0 z-10 bg-slate-700 border-t border-r border-b border-slate-600" style={{ minWidth: sheetConfig.colWidths?.[c] || DEFAULT_COL_WIDTH, width: sheetConfig.colWidths?.[c] || DEFAULT_COL_WIDTH }}>
                                    {colToLetter(c)}
                                    <div className="col-resizer" onMouseDown={(e) => handleColResizeStart(c, e)}></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: NUM_ROWS }).map((_, r) => (
                            <tr key={r} style={{ height: sheetConfig.rowHeights?.[r] || DEFAULT_ROW_HEIGHT }}>
                                <th className="p-1 text-center text-xs font-mono select-none sticky left-0 z-10 bg-slate-700 border-l border-r border-b border-slate-600" style={{height: sheetConfig.rowHeights?.[r] || DEFAULT_ROW_HEIGHT}}>
                                    {r + 1}
                                    <div className="row-resizer" onMouseDown={(e) => handleRowResizeStart(r, e)}></div>
                                </th>
                                {Array.from({ length: NUM_COLS }).map((_, c) => {
                                    const isSelected = selectedCell.row === r && selectedCell.col === c;
                                    const area = selectionArea || {start: selectedCell, end: selectedCell};
                                    const isInSelectionArea = r >= Math.min(area.start.row, area.end.row) && r <= Math.max(area.start.row, area.end.row) && c >= Math.min(area.start.col, area.end.col) && c <= Math.max(area.start.col, area.end.col);
                                    const cellData = gridData[r]?.[c];
                                    const cellStyle: React.CSSProperties = { fontWeight: cellData?.style?.bold ? 'bold' : 'normal', fontStyle: cellData?.style?.italic ? 'italic' : 'normal', textDecoration: cellData?.style?.underline ? 'underline' : 'none', color: cellData?.style?.color, backgroundColor: cellData?.style?.backgroundColor, textAlign: cellData?.style?.textAlign, borderTop: cellData?.style?.border?.top, borderRight: cellData?.style?.border?.right, borderBottom: cellData?.style?.border?.bottom, borderLeft: cellData?.style?.border?.left };
                                    return (
                                        <td key={c} className={`p-1 align-middle whitespace-nowrap overflow-hidden relative ${!cellData?.style?.border ? 'border border-slate-700' : ''}`} style={cellStyle} onClick={(e) => handleCellClick(r, c, e.shiftKey)} onDoubleClick={() => handleCellDoubleClick(r, c)} onMouseDown={(e) => handleMouseDown(r, c, e)} onMouseOver={() => handleMouseOver(r, c)} onContextMenu={(e) => handleCellContextMenu(e, r, c)}>
                                            {editingCell?.row === r && editingCell?.col === c ? (
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={handleCellChangeCommit}
                                                    onKeyDown={(e) => {
                                                        const isNavigationKey = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
                                                        
                                                        if (isNavigationKey) {
                                                            e.preventDefault();
                                                            const currentEditingCell = editingCell;
                                                            handleCellChangeCommit();
                                                            
                                                            if (currentEditingCell) {
                                                                let { row, col } = currentEditingCell;
                                                                
                                                                switch(e.key) {
                                                                    case 'Enter':
                                                                        row = e.shiftKey ? Math.max(0, row - 1) : Math.min(NUM_ROWS - 1, row + 1);
                                                                        break;
                                                                    case 'Tab':
                                                                        if (e.shiftKey) {
                                                                            col--;
                                                                            if (col < 0) { col = NUM_COLS - 1; row = Math.max(0, row - 1); }
                                                                        } else {
                                                                            col++;
                                                                            if (col >= NUM_COLS) { col = 0; row = Math.min(NUM_ROWS - 1, row + 1); }
                                                                        }
                                                                        break;
                                                                    case 'ArrowUp':
                                                                        row = Math.max(0, row - 1);
                                                                        break;
                                                                    case 'ArrowDown':
                                                                        row = Math.min(NUM_ROWS - 1, row + 1);
                                                                        break;
                                                                    case 'ArrowLeft':
                                                                        col = Math.max(0, col - 1);
                                                                        break;
                                                                    case 'ArrowRight':
                                                                        col = Math.min(NUM_COLS - 1, col + 1);
                                                                        break;
                                                                }
                                                                handleCellClick(row, col, false);
                                                                gridContainerRef.current?.focus();
                                                            }
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            setEditingCell(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                    className="w-full h-full bg-slate-900 text-slate-100 outline-none p-0 m-0 border-none font-sans"
                                                    style={{textAlign: cellStyle.textAlign}}
                                                />
                                            ) : (
                                                <div className="w-full h-full truncate">{cellData?.value || ''}</div>
                                            )}
                                            {isInSelectionArea && !isSelected && <div className="absolute inset-0 spreadsheet-selection-area pointer-events-none"></div>}
                                            {isSelected && <div className="absolute inset-[-1px] border-2 border-sky-400 pointer-events-none"></div>}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {activeCursors.map(cursor => (
                    <div key={cursor.username} className="absolute pointer-events-none transition-all duration-100 ease-linear" style={{ top: (Array.from({length: cursor.row}).reduce((acc: number, _, i) => acc + (sheetConfig.rowHeights?.[i] || DEFAULT_ROW_HEIGHT), DEFAULT_ROW_HEIGHT)) as number, left: (Array.from({length: cursor.col}).reduce((acc: number, _, i) => acc + (sheetConfig.colWidths?.[i] || DEFAULT_COL_WIDTH), 48)) as number }}>
                        <div className="absolute inset-[-1px] border-2" style={{borderColor: nameToColor(cursor.username)}}></div>
                        <div className="absolute -top-6 left-[-1px] text-xs px-1.5 py-0.5 rounded-t-md text-white" style={{backgroundColor: nameToColor(cursor.username)}}>{cursor.username}</div>
                    </div>
                ))}
            </div>
            <SheetTabs sheets={sheets} activeSheetId={activeSheetId} onSelectSheet={handleSelectSheet} onAddSheet={handleAddSheet} onRenameSheet={handleRenameSheet} onDeleteSheet={handleDeleteSheet} onContextMenu={handleSheetContextMenu}/>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} onStyleChange={handleStyleChange} selectedCellStyle={selectedRangeStyle()} onClear={() => { handleBulkClear(); setContextMenu(null); }} onShowLogs={() => { if (!contextMenu) return; const logs = gridData[contextMenu.row]?.[contextMenu.col]?.history || []; setCellLogs(logs); setIsLogModalOpen(true); setContextMenu(null); }} />}
            {sheetContextMenu && <SheetContextMenu x={sheetContextMenu.x} y={sheetContextMenu.y} sheet={sheetContextMenu.sheet} onClose={() => setSheetContextMenu(null)} onDelete={() => handleDeleteSheet(sheetContextMenu.sheet.id, sheetContextMenu.sheet.name)} />}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="AI Asistan ile Doldur"><div className="space-y-4"><p className="text-sm text-slate-400">Seçili hücreden başlayarak tabloyu doldurmak için bir komut girin.</p><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Örn: 2024 yılı için aylık satış verilerini içeren bir tablo oluştur." /><div className="pt-2 flex justify-end"><button onClick={handleAiSubmit} disabled={isAiLoading || !aiPrompt.trim()} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50">{isAiLoading ? 'Oluşturuluyor...' : 'Oluştur'}</button></div></div></Modal>
            <LogViewerModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} logs={cellLogs} />
        </div>
    );
};