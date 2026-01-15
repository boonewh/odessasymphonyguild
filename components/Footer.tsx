export default function Footer() {
  return (
    <footer className="bg-[#0f0f1e] text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-6 text-center space-y-4">
        <p className="text-sm">
          &copy; 2026 Odessa Symphony Guild. All rights reserved.
        </p>
        <p className="text-sm">
          Supporting the West Texas Symphony since 1958
        </p>
        <p className="text-xs text-gray-500">
          A 501(c)(3) Non-Profit Organization
        </p>
        <p className="text-xs text-gray-600 mt-4">
          webpage by:{' '}
          <a
            href="https://pathsixsolutions.com/web-design"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
            style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700 }}
          >
            Path<span className="text-amber-500">Six</span> Solutions
          </a>
        </p>
      </div>
    </footer>
  );
}