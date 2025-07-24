"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface ProcessingResult {
  success: boolean;
  exam_id?: string;
  file_name?: string;
  score?: number;
  responses?: Record<string, string>;
  response_array?: string[];
  multi_marked?: boolean;
  processed_at?: string;
  error?: string;
}

export default function ExamProcessor() {
  const [examId, setExamId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [serverStatus, setServerStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!examId || !selectedFile) {
      alert("Please provide both exam ID and select an image file");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("exam_id", examId);
      formData.append("image", selectedFile);

      const response = await fetch("/api/process-exam", {
        method: "POST",
        body: formData,
      });

      const data: ProcessingResult = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error processing exam:", error);
      setResult({
        success: false,
        error:
          "Failed to process the exam. Please check that the processing server is running.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setExamId("");
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
  };

  const checkServerStatus = async () => {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();
      setServerStatus(
        data.connection.status === "connected" ? "connected" : "disconnected"
      );
    } catch (error) {
      console.error("Error checking server status:", error);
      setServerStatus("disconnected");
    }
  };

  useEffect(() => {
    checkServerStatus();
    // Check status every 30 seconds
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            OMR Exam Processor
          </h1>
          <p className="text-lg text-gray-600">
            Upload your exam sheet to automatically process and score the
            results
          </p>

          {/* Server Status Indicator */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                serverStatus === "checking"
                  ? "bg-yellow-500 animate-pulse"
                  : serverStatus === "connected"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            ></div>
            <span
              className={`text-sm ${
                serverStatus === "checking"
                  ? "text-yellow-600"
                  : serverStatus === "connected"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {serverStatus === "checking"
                ? "Checking server status..."
                : serverStatus === "connected"
                ? "Processing server connected"
                : "Processing server disconnected"}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Upload Exam Sheet
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Exam ID Input */}
              <div>
                <label
                  htmlFor="examId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Exam ID
                </label>
                <input
                  type="text"
                  id="examId"
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  placeholder="Enter exam identifier (e.g., EXAM_001)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* File Input */}
              <div>
                <label
                  htmlFor="imageFile"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Exam Image
                </label>
                <input
                  type="file"
                  id="imageFile"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Supported formats: PNG, JPG, JPEG (max 16MB)
                </p>
              </div>

              {/* Image Preview */}
              {preview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <Image
                      src={preview}
                      alt="Exam sheet preview"
                      width={400}
                      height={300}
                      className="w-full h-48 object-contain bg-gray-50"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading || !examId || !selectedFile}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Processing..." : "Process Exam"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          {/* Results Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Processing Results
            </h2>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">
                  Processing exam sheet...
                </span>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {result.success ? (
                  <>
                    {/* Success Result */}
                    <div className="border border-green-200 bg-green-50 rounded-md p-4">
                      <div className="flex items-center">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white text-xs">✓</span>
                        </div>
                        <span className="text-green-800 font-medium">
                          Processing Successful
                        </span>
                      </div>
                    </div>

                    {/* Score Display */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        Score
                      </h3>
                      <div className="text-3xl font-bold text-blue-600">
                        {result.score
                          ? `${result.score}%`
                          : "No score available"}
                      </div>
                    </div>

                    {/* Exam Details */}
                    <div className="border border-gray-200 rounded-md p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Exam Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Exam ID:</span>
                          <span className="font-medium">{result.exam_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">File Name:</span>
                          <span className="font-medium">
                            {result.file_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Multi-marked:</span>
                          <span
                            className={`font-medium ${
                              result.multi_marked
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {result.multi_marked ? "Yes" : "No"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Processed:</span>
                          <span className="font-medium">
                            {result.processed_at
                              ? new Date(result.processed_at).toLocaleString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Responses */}
                    {result.responses &&
                      Object.keys(result.responses).length > 0 && (
                        <div className="border border-gray-200 rounded-md p-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Responses
                          </h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(result.responses).map(
                              ([question, answer]) => (
                                <div
                                  key={question}
                                  className="flex justify-between py-1"
                                >
                                  <span className="text-gray-600">
                                    {question}:
                                  </span>
                                  <span className="font-medium">{answer}</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </>
                ) : (
                  /* Error Result */
                  <div className="border border-red-200 bg-red-50 rounded-md p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white text-xs">✗</span>
                      </div>
                      <span className="text-red-800 font-medium">
                        Processing Failed
                      </span>
                    </div>
                    <p className="text-red-700 text-sm">
                      {result.error || "An unknown error occurred"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!result && !loading && (
              <div className="text-center py-12 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📄</span>
                </div>
                <p>Upload an exam sheet to see processing results</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>Processing powered by internal API</p>
        </div>
      </div>
    </div>
  );
}
