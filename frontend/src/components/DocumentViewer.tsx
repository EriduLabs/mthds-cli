import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import mammoth from 'mammoth';

interface DocumentViewerProps {
    url: string;
    filename: string;
    onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ url, filename, onClose }) => {
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isPdf = filename.toLowerCase().endsWith('.pdf');
    const isDocx = filename.toLowerCase().endsWith('.docx');

    // Determine if it is a legacy .doc file or an unsupported format
    const isUnsupported = !isPdf && !isDocx;

    useEffect(() => {
        if (isDocx) {
            setLoading(true);
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => {
                    return mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                })
                .then(result => {
                    setHtmlContent(result.value);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error rendering docx:', err);
                    setError('Failed to render the document. It may be corrupted or in an unexpected format.');
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [url, isDocx]);

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-5xl h-full max-h-[90vh] bg-[#282e33] border border-[#333c43] rounded-xl shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#333c43] bg-[#1d2125]">
                    <h3 className="text-xl font-bold text-gray-100 flex-1 truncate mr-4">{filename}</h3>
                    <div className="flex items-center gap-3">
                        <a
                            href={url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm transition-colors"
                        >
                            <Download className="w-4 h-4" /> Download
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-gray-100 overflow-y-auto relative p-0 m-0">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#282e33]">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#282e33] text-gray-300 p-8 text-center">
                            <h2 className="text-2xl font-bold mb-4 text-red-400">Preview Failed</h2>
                            <p className="mb-6">{error}</p>
                            <a href={url} download className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                                Download File
                            </a>
                        </div>
                    )}

                    {!loading && !error && isPdf && (
                        <iframe
                            src={url}
                            className="w-full h-full border-none"
                            title={filename}
                        />
                    )}

                    {!loading && !error && isDocx && (
                        <div className="w-full h-full bg-white text-black p-8 md:p-12 overflow-y-auto">
                            <div
                                className="max-w-4xl mx-auto prose prose-slate"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        </div>
                    )}

                    {!loading && !error && isUnsupported && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#282e33] text-gray-300 p-8 text-center">
                            <h2 className="text-2xl font-bold mb-4">Preview Not Available</h2>
                            <p className="mb-6 text-gray-400">This file format cannot be safely previewed in the browser.</p>
                            <a href={url} download className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                                Download File
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
