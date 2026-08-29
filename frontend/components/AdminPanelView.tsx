import React, { useState, useEffect } from "react";

const apiBaseUrl = ""; // Proxy to backend

interface AdminPanelViewProps {
  user: any;
  token: string;
}

interface CorpusFile {
  filename: string;
  filepath: string;
  size: number;
  mtime: number;
}

export default function AdminPanelView({ user, token }: AdminPanelViewProps) {
  const [files, setFiles] = useState<CorpusFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/corpus`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch corpus files.");
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [token]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a valid PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/corpus/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to upload file.");
      }

      setSuccess(`File ${file.name} uploaded successfully.`);
      await fetchFiles();
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setLoading(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleDelete = async (filepath: string) => {
    if (!window.confirm("Are you sure you want to delete this file? It will be removed from the active knowledge base after the next rebuild.")) return;
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/corpus`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filepath }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to delete file.");
      }

      setSuccess("File deleted successfully.");
      await fetchFiles();
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting.");
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!window.confirm("This will rebuild the entire AI knowledge base. It may take several minutes in the background. Continue?")) return;
    
    setIsIngesting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to trigger ingestion.");
      }
      
      const data = await res.json();
      setSuccess(data.message || "Knowledge base rebuild started in the background.");
    } catch (err: any) {
      setError(err.message || "An error occurred while starting ingestion.");
    } finally {
      setIsIngesting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (user?.role !== "admin") {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        Access Denied. You must be an administrator to view this page.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400 drop-shadow-sm">
          Knowledge Base Admin
        </h1>
        <p className="text-slate-400 mt-2">
          Manage the PDF corpus that the AI uses for RAG retrieval. Upload new laws, delete outdated ones, and rebuild the database.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-900/30 border border-red-500/50 text-red-200">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-900/30 border border-emerald-500/50 text-emerald-200">
          <p>{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-semibold text-white mb-4">Upload New Document</h2>
            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-slate-800 border-2 border-slate-600 border-dashed rounded-xl appearance-none cursor-pointer hover:border-orange-400 hover:bg-slate-800/80 focus:outline-none">
                <span className="flex items-center space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-medium text-slate-400">
                    Click to select PDF
                  </span>
                </span>
                <input type="file" name="file_upload" className="hidden" accept=".pdf" onChange={handleUpload} disabled={loading} />
              </label>
              <p className="text-xs text-slate-500 text-center">
                Supported formats: PDF. Files are uploaded directly to the active corpus.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-semibold text-white mb-4">Rebuild Knowledge Base</h2>
            <p className="text-sm text-slate-400 mb-6">
              After adding or removing files, you must rebuild the ChromaDB vector database for the AI to learn the changes.
            </p>
            <button
              onClick={handleIngest}
              disabled={isIngesting || loading}
              className={`w-full py-3 rounded-xl font-semibold transition-all shadow-lg ${
                isIngesting || loading
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-orange-500 to-rose-600 text-white hover:opacity-90 hover:shadow-orange-500/25 active:scale-[0.98]"
              }`}
            >
              {isIngesting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Rebuilding in Background...
                </div>
              ) : (
                "Trigger Knowledge Base Rebuild"
              )}
            </button>
          </div>
        </div>

        {/* Right Column: File List */}
        <div className="lg:col-span-2">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Current Corpus Files</h2>
              <button 
                onClick={fetchFiles}
                disabled={loading}
                className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {loading && files.length === 0 ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No PDF files found in the corpus.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Filename</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white truncate max-w-[200px]" title={file.filename}>
                          {file.filename}
                        </td>
                        <td className="px-4 py-3 text-slate-400 truncate max-w-[150px]" title={file.filepath}>
                          {file.filepath}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatSize(file.size)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(file.filepath)}
                            disabled={loading}
                            className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                            title="Delete file"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
