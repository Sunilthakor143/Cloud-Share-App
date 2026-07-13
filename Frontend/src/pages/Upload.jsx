import DashboardLayout from "../layout/DashboardLayout.jsx";
import {useContext, useState} from "react";
import {useAuth} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import {UserCreditsContext} from "../context/UserCreditsContext.jsx";
import {AlertCircle} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import {apiEndpoints} from "../util/apiEndpoints.js";
import UploadBox from "../components/UploadBox.jsx";


const Upload = () => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState(""); //success or error
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const {credits, setCredits} = useContext(UserCreditsContext);
    const MAX_FILES = 5;

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        if (files.length + selectedFiles.length > MAX_FILES) {
            setMessage(`You can only upload a maximum of ${MAX_FILES} files at once`);
            setMessageType("error");
            return;
        }

        //add the new files into the existing files
        setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
        setMessage("");
        setMessageType("");
    }

    const handleRemoveFile = (index) => {
        setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
        setMessageType("");
        setMessage("");
    }

    const handleUpload = async () => {
        if (files.length === 0){
            setMessageType("error");
            setMessage("Please select atleast one file to upload.");
            return;
        }

        if (files.length > MAX_FILES) {
            setMessage(`You can only upload a maximum of ${MAX_FILES} files at once.`);
            setMessageType("error");
            return;
        }

        // Out of credits (or not enough for this many files) - stop right here,
        // tell the user clearly, and take them straight to the page where they
        // can buy more instead of leaving them stuck on a disabled button.
        if (credits <= 0 || files.length > credits) {
            toast.error(
                credits <= 0
                    ? "You're out of credits. Redirecting you to buy more..."
                    : `You only have ${credits} credit${credits === 1 ? "" : "s"} left - not enough for ${files.length} files. Redirecting...`
            );
            setTimeout(() => navigate("/subscriptions"), 1500);
            return;
        }

        setUploading(true);
        setMessage("Uploading files...");
        setMessageType("info");

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        try {
            const token = await getToken();
            const response = await axios.post(apiEndpoints.UPLOAD_FILE, formData, {headers: {"Content-Type": "multipart/form-data", Authorization: `Bearer ${token}`}});

            if (response.data && response.data.remainingCredits !== undefined) {
                setCredits(response.data.remainingCredits);
            }

            setMessage("Files uploaded successfully.");
            setMessageType("success");
            setFiles([]);
        }catch(error) {
            console.error('Error uploading files: ', error);

            // The backend also rejects uploads when credits run out mid-request
            // (e.g. another tab/device used them first) - handle that the same way.
            if (error.response?.status === 400 && /credit/i.test(error.response?.data?.message || "")) {
                toast.error("You're out of credits. Redirecting you to buy more...");
                setTimeout(() => navigate("/subscriptions"), 1500);
            } else {
                setMessage(error.response?.data?.message || "Error uploading files. Please try again.");
                setMessageType("error");
            }
        }finally {
            setUploading(false);
        }
    }

    // Only genuinely blocking reasons (no files picked, or too many) disable the
    // button outright. Running out of credits is handled inside handleUpload above
    // so the click still fires and the person gets a clear message + redirect.
    const isUploadDisabled = files.length === 0 || files.length > MAX_FILES;


    return (
        <DashboardLayout activeMenu="Upload">
            <div className="p-6">
                {message && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${messageType === 'error' ? 'bg-red-50 text-red-700': messageType === 'success' ? 'bg-green-50 text-green-700': 'bg-blue-50 text-blue-700'}`}>
                        {messageType === 'error' && <AlertCircle size={20} />}
                        {message}
                    </div>
                )}

                <UploadBox
                    files={files}
                    onFileChange={handleFileChange}
                    onUpload={handleUpload}
                    uploading={uploading}
                    onRemoveFile={handleRemoveFile}
                    remainingCredits={credits}
                    isUploadDisabled={isUploadDisabled}
                />
            </div>
        </DashboardLayout>
    )
}

export default Upload;