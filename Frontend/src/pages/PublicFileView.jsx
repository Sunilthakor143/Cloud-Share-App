import {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useAuth} from "@clerk/clerk-react";
import axios from "axios";
import {apiEndpoints} from "../util/apiEndpoints.js";
import toast from "react-hot-toast";
import {Copy, Download, File, FileText, Info, Music, Share2} from "lucide-react";
import LinkShareModal from "../components/LinkShareModal.jsx";

// Works out what kind of preview a file supports, from its MIME type first
// (reliable, comes from the server) and falls back to the file extension.
const getPreviewKind = (file) => {
    const type = (file.type || "").toLowerCase();
    const extension = (file.name || "").split(".").pop().toLowerCase();

    if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(extension)) {
        return "image";
    }
    if (type.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(extension)) {
        return "video";
    }
    if (type.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "m4a"].includes(extension)) {
        return "audio";
    }
    if (type === "application/pdf" || extension === "pdf") {
        return "pdf";
    }
    if (
        type.startsWith("text/") ||
        type === "application/json" ||
        ["txt", "md", "csv", "log", "json", "js", "jsx", "ts", "tsx", "css", "html", "xml", "yml", "yaml"].includes(extension)
    ) {
        return "text";
    }
    return "unsupported";
};

// Small icon shown for file types that can't be previewed inline (docx, zip, etc.)
const UnsupportedIcon = ({file}) => {
    const extension = (file.name || "").split(".").pop().toLowerCase();

    if (["doc", "docx", "rtf"].includes(extension)) {
        return <FileText size={40} className="text-blue-500" />;
    }
    if (["xls", "xlsx", "csv"].includes(extension)) {
        return <FileText size={40} className="text-green-600" />;
    }
    if (["ppt", "pptx"].includes(extension)) {
        return <FileText size={40} className="text-orange-500" />;
    }
    return <File size={40} className="text-blue-500" />;
};

// Fetches small text files and renders their contents in a scrollable code block.
const TextPreview = ({url}) => {
    const [content, setContent] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        axios.get(url, {responseType: "text", transformResponse: [(data) => data]})
            .then((res) => {
                if (!cancelled) setContent(res.data);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    if (failed) {
        return (
            <p className="text-sm text-gray-500">
                Preview couldn't be loaded. Try downloading the file instead.
            </p>
        );
    }

    if (content === null) {
        return <p className="text-sm text-gray-500">Loading preview…</p>;
    }

    return (
        <pre className="w-full max-h-[500px] overflow-auto text-left text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap break-words">
            {content.slice(0, 20000)}
        </pre>
    );
};

const FilePreview = ({file}) => {
    const kind = getPreviewKind(file);

    if (kind === "image") {
        return (
            <img
                src={file.fileUrl}
                alt={file.name}
                className="max-h-[500px] w-auto max-w-full mx-auto rounded-lg border border-gray-200"
            />
        );
    }

    if (kind === "video") {
        return (
            <video
                src={file.fileUrl}
                controls
                className="max-h-[500px] w-full mx-auto rounded-lg border border-gray-200 bg-black"
            />
        );
    }

    if (kind === "audio") {
        return (
            <div className="flex flex-col items-center gap-4 py-6">
                <Music size={48} className="text-green-500" />
                <audio src={file.fileUrl} controls className="w-full max-w-md" />
            </div>
        );
    }

    if (kind === "pdf") {
        return (
            <iframe
                src={file.fileUrl}
                title={file.name}
                className="w-full h-[600px] rounded-lg border border-gray-200"
            />
        );
    }

    if (kind === "text") {
        return <TextPreview url={file.fileUrl} />;
    }

    // Unsupported preview type - show a friendly placeholder instead of pretending
    // there's a preview. The user can still download the file below.
    return (
        <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <UnsupportedIcon file={file} />
            </div>
            <p className="text-sm text-gray-500">
                Preview isn't available for this file type. Download it to view the contents.
            </p>
        </div>
    );
};

const PublicFileView = () => {
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [shareModal, setShareModal] = useState({
        isOpen: false,
        link: ""
    });
    const {getToken} = useAuth();
    const {fileId} = useParams();

    useEffect(() => {
        const getFile = async () => {
            setIsLoading(true);
            try {
                const res = await axios.get(
                    apiEndpoints.PUBLIC_FILE_VIEW(fileId)
                );
                setFile(res.data);
                setError(null);
            } catch (err) {
                console.error("Error fetching file:", err);
                setError(
                    "Could not retrieve file. The link may be invalid or the file may have been removed."
                );
            } finally {
                setIsLoading(false);
            }
        };
        getFile();
    }, [fileId, getToken]);

    const handleDownload = async () => {
        try {
            const response = await axios.get(
                apiEndpoints.DOWNLOAD_FILE(fileId),
                {
                    responseType: "blob",
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", file.name);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed:", err);
            toast.error("Sorry, the file could not be downloaded.");
        }
    };

    const openShareModal = () => {
        setShareModal({
            isOpen: true,
            link: window.location.href,
        });
    };

    const closeShareModal = () => {
        setShareModal({
            isOpen: false,
            link: "",
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <p className="text-gray-600">Loading file...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-red-600">Error</h2>
                    <p className="text-gray-600 mt-2">{error}</p>
                </div>
            </div>
        );
    }

    if (!file) return null;

    return (
        <div className="bg-gray-50 min-h-screen">
            <header className="p-4 border-b bg-white">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Share2 className="text-blue-600" />
                        <span className="font-bold text-xl text-gray-800">CloudShare</span>
                    </div>
                    <button
                        onClick={openShareModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <Copy size={18} />
                        Share Link
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 md:p-8 flex justify-center">
                <div className="w-full max-w-3xl">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
                        <h1 className="text-2xl font-semibold text-gray-800 break-words">
                            {file.name}
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">
                            {(file.size / 1024).toFixed(2)} KB
                            <span className="mx-2">&bull;</span>
                            Shared on {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>

                        <div className="my-6">
              <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full uppercase">
                {file.type || "File"}
              </span>
                        </div>

                        {/* Actual file preview, tailored to the file type */}
                        <div className="my-6">
                            <FilePreview file={file} />
                        </div>

                        <div className="flex justify-center gap-4 my-8">
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors shadow"
                            >
                                <Download size={18} />
                                Download File
                            </button>
                        </div>

                        <hr className="my-8" />

                        <div>
                            <h3 className="text-lg font-semibold text-left text-gray-800 mb-4">
                                File Information
                            </h3>
                            <div className="text-left text-sm space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">File Name:</span>
                                    <span className="text-gray-800 font-medium break-all">
                    {file.name}
                  </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">File Type:</span>
                                    <span className="text-gray-800 font-medium">{file.type}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">File Size:</span>
                                    <span className="text-gray-800 font-medium">
                    {(file.size / 1024).toFixed(2)} KB
                  </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Shared:</span>
                                    <span className="text-gray-800 font-medium">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-center gap-4">
                        <Info size={20} />
                        <p className="text-sm">
                            This file has been shared publicly. Anyone with this link can view
                            and download it.
                        </p>
                    </div>
                </div>
            </main>
            <LinkShareModal
                isOpen={shareModal.isOpen}
                onClose={closeShareModal}
                link={shareModal.link}
                title="Share File"
            />
        </div>
    )
}

export default PublicFileView;
