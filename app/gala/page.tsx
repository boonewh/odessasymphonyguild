"use client";
import { useState } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MediaReleaseModal from "@/components/MediaReleaseModal";

export default function GalaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timelineEvents = [
    {
      date: "Week of Jan 19",
      title: "Ball Shift Sign-Up Opens",
      align: "left",
      icon: "📋",
      content: (
        <>
          <p>Committee & Freshman Parents Sign Up.</p>
          <p className="text-sm text-emerald-300 italic mt-2">(Link coming soon)</p>
        </>
      ),
    },
    {
      date: "January 22",
      title: "Celebration Gift Forms & Drop-Off",
      align: "right",
      icon: "🎁",
      content: (
        <>
          <p>Gift card drop-off begins.</p>
          <p className="text-sm text-emerald-300 italic mt-2">
            Paperwork available at meeting.
          </p>
        </>
      ),
    },
    {
      date: "January 29",
      title: "Gifts & Gift Cards Due!",
      align: "left",
      icon: "💎",
      highlight: true,
      content: (
        <ul className="list-disc list-inside space-y-1 text-emerald-100/90 text-left">
          <li>Celebration Gifts & Forms Due</li>
          <li>Gift Cards Due</li>
          <li className="text-amber-300 font-semibold">
            Reminder: Two Gift Cards Per Child
          </li>
          <li className="text-amber-300 font-semibold">
            $50 Minimum (Cards, Cash, or Invoice)
          </li>
        </ul>
      ),
    },
    {
      date: "Sunday, Feb 1",
      title: "Curtsy & Bow Practice",
      align: "right",
      icon: "💃",
      content: <p>Times to be announced soon.</p>,
    },
  ];

  return (
    <div className="min-h-screen bg-[#051a12] text-white font-sans selection:bg-emerald-500 selection:text-white">
      <Header />

{/* --- HERO SECTION --- */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        
        {/* BACKGROUND LAYERS */}
        <div className="absolute inset-0 z-0">
          {/* 1. Base Image */}
          <div className="absolute inset-0">
            <Image
              src="/images/emerald-city-bg.png"
              alt="Emerald City Skyline"
              fill
              className="object-cover object-bottom"
              priority
            />
          </div>

          {/* 2. Flat Dimmer: Lowers overall brightness so text isn't fighting the pixels */}
          <div className="absolute inset-0 bg-black/40" />

          {/* 3. Gradient Mask: The Magic Fix 
              - Top (from-black/80): Very dark behind the header text
              - Middle (via-transparent): Clear so the Road/City shines through
              - Bottom (to-[#051a12]): Blends seamlessly into the next section
          */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-transparent to-[#051a12]" />
          
          {/* 4. Texture: Optional stardust */}
          <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
        </div>

        {/* CONTENT */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-16">
          <div className="animate-fade-in-up">
            {/* Added 'drop-shadow-md' to small text */}
            <span className="block text-emerald-400 font-bold tracking-[0.3em] uppercase mb-4 text-sm sm:text-base drop-shadow-md">
              Follow the Yellow Brick Road to the
            </span>
            
            {/* Added heavier drop-shadow to main title */}
            <h1 className="font-tangerine text-7xl sm:text-8xl md:text-9xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-b from-[#fbbf24] to-[#d97706] drop-shadow-[0_4px_4px_rgba(0,0,0,1)]">
              Annual Symphony Gala
            </h1>
            
            {/* Changed to pure white + heavier shadow for readability */}
            <h2 className="text-2xl sm:text-4xl font-light text-white italic opacity-100 mb-8 drop-shadow-lg">
              "One Short Day in the Emerald City"
            </h2>
            
            {/* Darkened the background of this box (bg-black/70) so it's readable over the road */}
            <div className="inline-block border border-amber-400/50 bg-black/70 backdrop-blur-md rounded-xl p-6 md:p-8 mt-4 transform hover:scale-105 transition-transform duration-300 shadow-2xl">
              <p className="text-amber-400 font-bold tracking-widest text-sm uppercase mb-2">
                Urgent Reminder
              </p>
              <p className="text-xl md:text-3xl font-serif text-white mb-2">
                All Tickets & Tables Must Be Purchased By
              </p>
              <p className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow-sm">
                FRIDAY, JANUARY 16TH
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- THE YELLOW BRICK ROAD (TIMELINE) --- */}
      <section className="relative pt-20 overflow-hidden">
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-6xl md:text-7xl font-tangerine text-emerald-200">
              Important Dates & Reminders
            </h2>
            <p className="text-xl text-emerald-400/80">
              As we follow the road to the Ball...
            </p>
          </div>

          <div className="relative flex flex-col">
            {timelineEvents.map((event, index) => (
              <TimelineItem
                key={index}
                {...event}
                index={index}
                isLast={index === timelineEvents.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* --- ABOUT SECTION --- */}
      <section className="pt-10 pb-20 bg-gradient-to-b from-[#051a12] to-[#0f382a]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mb-12">
            <div className="w-72 h-72 mx-auto mb-6 relative opacity-80 flex items-center justify-center">
              <Image
                src="/images/wicked-hat.png"
                alt="Magic Icon"
                width={300}
                height={300}
                className="object-contain"
              />
            </div>
            <h2 className="text-4xl md:text-5xl font-light mb-8 text-white">
              A Defying Gravity Evening
            </h2>
            <div className="space-y-6 text-lg leading-relaxed text-emerald-100/80">
              <p>
                Our annual Symphony Gala Ball is the highlight of the social
                season, honoring our dedicated Belles and Beaux while raising
                vital funds to support the West Texas Symphony.
              </p>
              <p>
                The evening features the formal presentation of our freshman,
                sophomore, and junior Belles and Beaux, culminating in a special
                recognition of our seniors and their four years of exemplary
                service to the Guild and our community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER CTA --- */}
      <section className="py-16 bg-emerald-950 border-t border-emerald-900 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-light mb-6 text-amber-400">
            Join the Magic
          </h2>
          <p className="mb-8 text-emerald-200">
            For membership inquiries and more information about supporting the
            Guild.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://www.facebook.com/odessasymphonyguild/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-full transition-all duration-300 border border-emerald-600 hover:border-amber-400 shadow-lg hover:shadow-amber-400/20"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Connect on Facebook
            </a>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-3 px-8 py-3 bg-transparent hover:bg-amber-400/10 text-amber-400 rounded-full transition-all duration-300 border border-amber-400/50 hover:border-amber-400 shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Student Photo Release Form
            </button>
          </div>
        </div>
      </section>

      {/* Media Release Modal */}
      <MediaReleaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <Footer />
    </div>
  );
}

// --- NEW COMPONENT WITH WINDING ROAD LOGIC ---
function TimelineItem({
  date,
  title,
  content,
  align,
  icon,
  highlight,
  index,
  isLast,
}: any) {
  const isRight = align === "right";
  // Determine if this segment should curve left or right based on index
  const curveDirection = index % 2 === 0 ? "right" : "left";

  return (
    <div
      className={`relative flex flex-col md:flex-row items-start justify-between group pb-24 ${
        isRight ? "md:flex-row-reverse" : ""
      }`}
    >
      {/* 
         THE WINDING ROAD SVG
      */}
      {!isLast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-8 bottom-[-2rem] w-32 -z-0 hidden md:block overflow-visible pointer-events-none">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id={`grad-${index}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#d97706" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              d={
                curveDirection === "right"
                  ? "M 50,0 C 90,25 90,75 50,100" 
                  : "M 50,0 C 10,25 10,75 50,100"
              }
              fill="none"
              stroke={`url(#grad-${index})`}
              strokeWidth="4"
              strokeDasharray="8 4"
              filter="url(#glow)"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      {/* 
         MOBILE LINE
      */}
      {!isLast && (
        <div className="absolute md:hidden left-1/2 -translate-x-1/2 top-8 bottom-[-2rem] w-1 bg-gradient-to-b from-yellow-400 to-amber-600 z-0 opacity-50 border-l-2 border-dashed border-amber-300"></div>
      )}

      {/* Content Box */}
      <div
        className={`w-full md:w-5/12 mb-8 md:mb-0 ${
          isRight ? "md:text-left" : "md:text-right"
        } text-center relative z-10 pt-4`}
      >
        <div
          className={`inline-block p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:-translate-y-1
          ${
            highlight
              ? "bg-gradient-to-br from-amber-900/40 to-emerald-900/40 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              : "bg-emerald-900/30 border-emerald-700/50 hover:border-emerald-500/50"
          }`}
        >
          <h3 className="text-amber-400 font-bold text-xl mb-1 uppercase tracking-wider">
            {date}
          </h3>
          <h4 className="text-white text-lg font-serif mb-3">{title}</h4>
          <div className="text-emerald-100/80 leading-relaxed">{content}</div>
        </div>
      </div>

      {/* The Icon (Road Stop) - Formatted with backticks to prevent string errors */}
      <div className={`
        relative z-10 flex items-center justify-center 
        w-12 h-12 md:w-16 md:h-16 shrink-0 mx-auto md:mx-0
        rounded-full bg-emerald-950 
        border-2 md:border-4 border-amber-400 
        shadow-[0_0_15px_rgba(251,191,36,0.5)]
      `}>
        <span className="text-2xl md:text-3xl filter drop-shadow-lg">
          {icon}
        </span>
      </div>

      <div className="hidden md:block w-5/12" />
    </div>
  );
}