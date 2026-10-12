import './globals.css';

export const metadata = {
  title: 'AI Product Recommender',
  description: 'Product recommendations powered by Google Gemini',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
