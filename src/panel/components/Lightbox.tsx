import { useEffect } from 'react';
import { saveToFile } from '@/lib/file-utils';

interface LightboxProps {
    image: string
    onClose: () => void;
}
function Lightbox({image, onClose} :LightboxProps) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div id="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot" className="fixed inset-0 bg-black/80 flex items-center justify-center z-100 cursor-pointer">
            <button
                id="lightbox-close-btn"
                aria-label="Close"
                className="absolute top-[10px] right-[10px] bg-white/15 text-white border border-solid border-white/30 rounded-[4px] py-1 px-3 font-[inherit] text-[18px] leading-none cursor-pointer hover:bg-white/30"
                onClick={onClose}>
                &times;
            </button>
            <button
                id="lightbox-save-btn"
                onClick={() => saveToFile(image)}
                className="absolute top-[10px] right-[50px] bg-white/15 text-white border border-solid border-white/30 rounded-[4px] py-1 px-[14px] font-[inherit] text-[12px] cursor-pointer hover:bg-white/30"
            >
                Save
            </button>
            <img
                id="lightbox-img"
                alt="Screenshot"
                src={image}
                className="max-w-[95%] max-h-[95%] rounded-[4px] shadow-[0_4px_20px_rgba(0,0,0,0.5)] cursor-default" 
            />
        </div>
    );
}

export default Lightbox;