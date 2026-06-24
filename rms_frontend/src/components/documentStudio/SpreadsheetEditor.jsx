import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { toast } from 'react-hot-toast';
import { ExportMenu, ExportConfirmModal, SaveIndicator } from './shared';
import { FileSpreadsheet, FileText } from 'lucide-react';

// Fortune-sheet stores cells as a sparse {r, c, v} list; flatten each sheet into a 2D array.
const fortuneSheetToAOA = (celldata = []) => {
  let maxR = -1, maxC = -1;
  celldata.forEach(cell => { maxR = Math.max(maxR, cell.r); maxC = Math.max(maxC, cell.c); });
  if (maxR < 0 || maxC < 0) return [['']];
  const aoa = Array.from({ length: maxR + 1 }, () => Array.from({ length: maxC + 1 }, () => ''));
  celldata.forEach(cell => {
    const v = cell.v;
    let value = '';
    if (v !== null && typeof v === 'object') {
      value = v.v !== undefined && v.v !== null ? v.v : (v.m || '');
    } else if (v !== null && v !== undefined) {
      value = v;
    }
    aoa[cell.r][cell.c] = value;
  });
  return aoa;
};

const sheetsToWorkbook = (sheets) => {
  const wb = XLSX.utils.book_new();
  (sheets || []).forEach((sheet, idx) => {
    const aoa = fortuneSheetToAOA(sheet.celldata);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, (sheet.name || `Sheet${idx + 1}`).slice(0, 31));
  });
  return wb;
};

const SpreadsheetEditor = ({ loadedDraft, onAutosave }) => {
  const [title, setTitle] = useState(loadedDraft?.title || 'Untitled Spreadsheet');
  const [saving, setSaving] = useState(false);
  const rawSheetData = loadedDraft?.data;
  const sheetData = useRef(Array.isArray(rawSheetData) && rawSheetData.length > 0
    ? rawSheetData
    : [{ name: "Sheet1", celldata: [] }]);
  const autoSaveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
  }, []);

  const handleSheetChange = (data) => {
    sheetData.current = data;
    setSaving(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      onAutosave({ title, data: sheetData.current });
      setSaving(false);
    }, 1500);
  };

  useEffect(() => {
    // Hook up title change autosave
    setSaving(true);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      onAutosave({ title, data: sheetData.current });
      setSaving(false);
    }, 1500);
  }, [title]);

  const [exportType, setExportType] = useState(null);
  const [exporting, setExporting] = useState(false);

  const previewAoa = exportType ? fortuneSheetToAOA(sheetData.current?.[0]?.celldata) : null;

  const handleConfirmExport = useCallback(async () => {
    if (!exportType) return;
    setExporting(true);
    try {
      const wb = sheetsToWorkbook(sheetData.current);
      if (exportType === 'xlsx') {
        XLSX.writeFile(wb, `${title}.xlsx`);
      } else if (exportType === 'csv') {
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${title}.csv`);
      }
      toast.success('Spreadsheet exported and saved locally.');
      setExportType(null);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exportType, title]);

  const exportFormats = [
    { type: 'xlsx', label: 'Export as Excel (.xlsx)', icon: FileSpreadsheet },
    { type: 'csv', label: 'Export as CSV', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2 w-full max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black text-foreground bg-transparent outline-none border-b-2 border-transparent focus:border-primary/50 transition-all pb-1 w-full max-w-lg"
            placeholder="Spreadsheet Title..."
          />
          <SaveIndicator saving={saving} />
        </div>
        <ExportMenu onExport={(type) => setExportType(type)} formats={exportFormats} />
      </div>

      <div className="glass bg-white/70 border border-border/50 rounded-2xl overflow-hidden shadow-sm h-[600px] w-full relative">
        <Workbook data={sheetData.current} onChange={handleSheetChange} />
      </div>

      <ExportConfirmModal
        open={!!exportType}
        title={`Export "${title}" as ${exportType === 'xlsx' ? 'Excel (.xlsx)' : 'CSV'}`}
        exporting={exporting}
        onConfirm={handleConfirmExport}
        onClose={() => setExportType(null)}
      >
        <div className="bg-white border border-border/40 rounded-xl shadow-sm overflow-auto max-h-[55vh]">
          <table className="text-xs border-collapse w-full">
            <tbody>
              {(previewAoa || []).slice(0, 30).map((row, r) => (
                <tr key={r}>
                  {row.slice(0, 20).map((cell, c) => (
                    <td key={c} className="border border-border/30 px-2 py-1 whitespace-nowrap">{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground p-2">Preview of "{sheetData.current?.[0]?.name || 'Sheet1'}" — additional sheets/rows are included in the downloaded file.</p>
        </div>
      </ExportConfirmModal>
    </div>
  );
};

export default SpreadsheetEditor;
