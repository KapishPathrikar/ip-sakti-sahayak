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
      <div className="max-w-md mx-auto my-16 p-8 text-center bg-white rounded-2xl border card-border ambient-shadow space-y-3">
        <span className="material-symbols-outlined text-4xl text-[#B33A3A]">gpp_bad</span>
        <h2 className="text-lg font-bold text-[#1E1B18]">Access Restricted</h2>
        <p className="text-xs text-[#645D56]">You must have administrator privileges to manage the statutory corpus.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-8 animate-in fade-in">
      {/* Header aligned with Sandstone Authority theme */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2]/80 text-[#7D4F39] text-xs font-semibold uppercase tracking-wider border card-border">
          <span className="material-symbols-outlined text-sm">database</span>
          <span>Knowledge Base Corpus Management</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1E1B18] tracking-tight font-serif">
          Knowledge Base Admin
        </h1>
        <p className="text-sm md:text-base text-[#645D56] leading-relaxed max-w-3xl">
          Manage the official statutory and regulatory PDF corpus that the AI references for RAG retrieval. Upload verified acts, delete outdated documents, and trigger vector re-indexing.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F5C2C7] text-[#842029] flex items-center gap-2.5 text-sm font-medium">
          <span className="material-symbols-outlined text-lg shrink-0">error</span>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 rounded-xl bg-[#F0F9F1] border border-[#C3E6CB] text-[#155724] flex items-center gap-2.5 text-sm font-medium">
          <span className="material-symbols-outlined text-lg shrink-0">check_circle</span>
          <p>{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload New Document Card */}
          <div className="p-6 rounded-2xl bg-white border card-border ambient-shadow space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] border card-border flex items-center justify-center text-[#7D4F39] shrink-0">
                <span className="material-symbols-outlined text-lg">upload_file</span>
              </div>
              <h2 className="text-lg font-bold text-[#1E1B18]">Upload New Document</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              <label className="flex flex-col items-center justify-center w-full h-36 px-4 transition bg-[#FAF7F2]/60 border-2 border-dashed border-[#E5DCD0] rounded-xl cursor-pointer hover:border-[#7D4F39] hover:bg-[#F6EDE7]/40 group">
                <span className="material-symbols-outlined text-3xl text-[#8C827A] group-hover:text-[#7D4F39] transition-colors mb-2">
                  cloud_upload
                </span>
                <span className="font-semibold text-sm text-[#1E1B18] group-hover:text-[#7D4F39] text-center">
                  Click to select statutory PDF
                </span>
                <span className="text-xs text-[#8C827A] mt-1 text-center">
                  Acts, rules, circulars, or TKDL files
                </span>
                <input type="file" name="file_upload" className="hidden" accept=".pdf" onChange={handleUpload} disabled={loading} />
              </label>
              <p className="text-xs text-[#8C827A] text-center leading-relaxed">
                Supported formats: PDF. Files are uploaded directly to the active corpus directory.
              </p>
            </div>
          </div>

          {/* Rebuild Knowledge Base Card */}
          <div className="p-6 rounded-2xl bg-white border card-border ambient-shadow space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] border card-border flex items-center justify-center text-[#7D4F39] shrink-0">
                <span className="material-symbols-outlined text-lg">sync</span>
              </div>
              <h2 className="text-lg font-bold text-[#1E1B18]">Rebuild Knowledge Base</h2>
            </div>
            <p className="text-xs text-[#645D56] leading-relaxed">
              After adding or removing files, rebuild the ChromaDB vector database so the AI indexes the updated statutory corpus.
            </p>
            <button
              onClick={handleIngest}
              disabled={isIngesting || loading}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                isIngesting || loading
                  ? "bg-[#E5DCD0] text-[#8C827A] cursor-not-allowed"
                  : "bg-[#7D4F39] hover:bg-[#643B28] text-white"
              }`}
            >
              {isIngesting ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  <span>Rebuilding in Background...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">bolt</span>
                  <span>Trigger Knowledge Base Rebuild</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: File List */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white border card-border ambient-shadow overflow-hidden flex flex-col">
            {/* Header Strip */}
            <div className="bg-[#FAF7F2]/80 px-6 py-4 border-b card-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border card-border flex items-center justify-center text-[#7D4F39] shrink-0">
                  <span className="material-symbols-outlined text-lg">folder_open</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E1B18]">Current Corpus Files</h2>
                  <p className="text-xs text-[#8C827A]">{files.length} statutory files</p>
                </div>
              </div>
              <button 
                onClick={fetchFiles}
                disabled={loading}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border card-border text-[#645D56] hover:bg-[#F1EDE6] hover:border-[#7D4F39] hover:text-[#1E1B18] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
                <span>Refresh</span>
              </button>
            </div>

            {loading && files.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-16 gap-3 text-sm text-[#8C827A]">
                <span className="material-symbols-outlined text-3xl text-[#7D4F39] animate-spin">sync</span>
                <span>Loading corpus documents...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-16 px-6 text-[#8C827A] space-y-2">
                <span className="material-symbols-outlined text-4xl text-[#8C827A]">folder_off</span>
                <p className="font-semibold text-sm text-[#1E1B18]">No PDF files found in the corpus.</p>
                <p className="text-xs">Upload your first statutory PDF document using the form on the left.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#1E1B18]">
                  <thead className="text-[11px] font-bold uppercase tracking-wider bg-[#FAF7F2]/60 text-[#8C827A] border-b card-border">
                    <tr>
                      <th className="px-5 py-3">Filename</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DCD0]/60">
                    {files.map((file, i) => (
                      <tr key={i} className="hover:bg-[#FAF7F2]/40 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[#1E1B18] max-w-[240px]" title={file.filename}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#7D4F39] text-base shrink-0">description</span>
                            <span className="truncate">{file.filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#645D56] max-w-[170px]" title={file.filepath}>
                          <span className="font-mono bg-[#FAF7F2] border border-[#E5DCD0]/60 px-2 py-0.5 rounded text-[11px] truncate block max-w-full">
                            {file.filepath}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#645D56] whitespace-nowrap font-medium">
                          {formatSize(file.size)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleDelete(file.filepath)}
                            disabled={loading}
                            className="text-[#8C827A] hover:text-[#B33A3A] p-1.5 rounded-lg hover:bg-[#FDF2F2] transition-colors cursor-pointer"
                            title="Delete file from corpus"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
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
