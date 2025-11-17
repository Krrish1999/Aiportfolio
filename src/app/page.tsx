import ResumeUpload from '@/components/ResumeUpload';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900">
            AI Resume Portfolio
          </h1>
          <p className="text-xl text-gray-600">
            Convert your resume into a professional portfolio website
          </p>
          <p className="text-sm text-gray-500">
            Upload your resume and let AI transform it into a stunning developer portfolio
          </p>
        </div>
        
        <ResumeUpload />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="text-center p-6">
            <div className="text-3xl mb-2">📄</div>
            <h3 className="font-semibold text-gray-900 mb-2">Upload Resume</h3>
            <p className="text-sm text-gray-600">
              Upload your PDF or DOCX resume
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-2">✨</div>
            <h3 className="font-semibold text-gray-900 mb-2">AI Enhancement</h3>
            <p className="text-sm text-gray-600">
              AI extracts and enhances your content
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-2">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-2">Deploy</h3>
            <p className="text-sm text-gray-600">
              Publish your portfolio instantly
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}