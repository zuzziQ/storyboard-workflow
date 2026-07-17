import { useEffect, useRef, memo } from 'react';

interface HighlightedTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  placeholder?: string;
  bannedWords?: string[];
  rows?: number;
  className?: string;
  disabled?: boolean;
}

// Component helper tô màu các từ cấm trực quan trong textbox
const HighlightedTextarea = memo(function HighlightedTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  bannedWords = [],
  rows = 5,
  className,
  disabled
}: HighlightedTextareaProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync scroll từ textarea sang backdrop overlay
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  // Tạo HTML highlight các từ cấm
  const getHighlightedHtml = (text: string) => {
    if (!text) return "";
    
    // Escape HTML để tránh XSS
    const html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (bannedWords.length === 0) return html;

    // Sắp xếp các từ cấm dài trước để tránh overlap substring
    const sortedWords = [...bannedWords].sort((a, b) => b.length - a.length);
    const escapedWords = sortedWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    
    // Regex tìm từ cấm không phân biệt hoa thường
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

    return html.replace(regex, '<mark class="bg-rose-500/40 text-transparent border-b border-rose-500 rounded px-0.5">$1</mark>');
  };

  return (
    <div 
      className={`relative w-full border border-slate-800 focus-within:border-indigo-500/50 rounded-lg resize-y overflow-hidden bg-[#09090c] ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className || ''}`} 
      style={className && (className.includes('h-') || className.includes('min-h-')) ? undefined : { height: `${rows * 22}px` }}
    >
      {/* Backdrop overlay ở phía sau để hiển thị highlight */}
      <div
        ref={backdropRef}
        className="absolute inset-0 p-2 text-[11px] leading-normal font-sans pointer-events-none whitespace-pre-wrap break-words overflow-auto custom-scrollbar select-none text-transparent bg-[#09090c]"
        style={{
          boxSizing: 'border-box',
          margin: 0,
          border: 'none',
          width: '100%',
          height: '100%'
        }}
        dangerouslySetInnerHTML={{ __html: getHighlightedHtml(value) + "\n\n" }}
      />
      {/* Textarea thực tế ở phía trước với nền trong suốt */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onScroll={handleScroll}
        disabled={disabled}
        className="absolute inset-0 w-full h-full bg-transparent p-2 text-[11px] text-indigo-300 outline-none leading-normal custom-scrollbar caret-white resize-none disabled:cursor-not-allowed"
        style={{
          boxSizing: 'border-box',
          margin: 0,
          border: 'none',
          width: '100%',
          height: '100%'
        }}
        placeholder={placeholder}
      />
    </div>
  );
});

export default HighlightedTextarea;
