import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "US Interconnection Queue";
const description =
  "Queue size, fuel mix, and market signals for US ISO/RTO generator interconnection backlogs";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/images/logo.svg",
    apple: "/images/logo.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: title,
    title,
    description,
    images: [
      {
        url: "/images/hero-transmission.jpg",
        width: 1920,
        height: 1080,
        alt: "High-voltage transmission towers at sunset",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/hero-transmission.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Dataset",
      "@id": `${siteUrl}/#dataset`,
      name: "US ISO/RTO Interconnection Queue Data",
      description:
        "Unified dataset of power generation projects waiting to connect to the US grid across all 7 major ISO/RTOs: ERCOT, MISO, PJM, CAISO, SPP, NYISO, and ISO-NE. Includes project fuel mix, requested MW capacity, and queue status, refreshed daily.",
      url: siteUrl,
      creator: {
        "@type": "Organization",
        name: "Kardashev Labs",
        url: "https://kardashevlabs.org",
      },
      keywords: [
        "interconnection queue",
        "ERCOT",
        "MISO",
        "PJM",
        "CAISO",
        "SPP",
        "NYISO",
        "ISO-NE",
        "power generation projects",
        "grid interconnection",
      ],
      temporalCoverage: "..",
      license: "https://opensource.org/licenses/MIT",
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: title,
      description,
      publisher: {
        "@type": "Organization",
        name: "Kardashev Labs",
        url: "https://kardashevlabs.org",
      },
      inLanguage: "en-US",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSans.variable} h-full`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
