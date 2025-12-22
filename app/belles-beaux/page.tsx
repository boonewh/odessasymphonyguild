"use client";

import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function BellesBeaux() {
  const classes = [
    {
      title: "Junior Class",
      image: "/images/juniors-25-26.jpg", // Black & White formal
      rows: [
        { label: "Left to Right", names: "DeLanie Sparks, Holly Forrest, Emma Bradley, Madilynn Moon, Audra Wilson, Jalie Lankford, Presley Williams, Ellie Molinar, Sofia Pulido, Blaire Capellini, Holden Madison, Braxton White, Cooper Veretto, Kasen Smart, Javid Payne, Tiago Contreras, Moses Williams, Addison Grisham, Kinley Weaver, Addysen Nelson, Audrina Olivas, Catalina Martinez, Anali Ruiz, Ava Branecky, Rylee Watson, Payton Reed, Madelyn Lopez, Natalie Wilson" },
        { label: "Not Pictured", names: "Brady Colley, Landree Colley, Ethan Henager, John Johnson, Ellie Mourning" }
      ]
    },
    {
      title: "Sophomore Class",
      image: "/images/sophomores-25-26.jpg", // Blue OSG T-shirts
      rows: [
        { label: "Back Row (L-R)", names: "Karston Gonzalez, Henry Branum, Walker Waters, Paxton Davis, Logan Najera" },
        { label: "Middle Row (L-R)", names: "Rowan Brazell, Jemma Cruz, Lynnlee Patton, Julia Rose, Anna Windham, Presli Smith, Elodie George, Madyson Wright, Brooklynn Baughman, Taryn Ray, Heath Ulate" },
        { label: "Front Row (L-R)", names: "Marc Capellini, Rylan Ford, Natalia Nieto, Atiyanna Earl, Conner Gonzalez, Creighton Arnold, Tommy Garcia" },
        { label: "Not Pictured", names: "Cannon Sandell, Graham Thompson" }
      ]
    },
    {
      title: "Freshmen Class",
      image: "/images/freshmen-25-26.jpg", // Formal black dresses/red ties
      rows: [
        { label: "Back Row (L-R)", names: "Willow Waters, Adalyn Foster, Baylie Baughman, Carter Madison, Brooklyn Williamson, Reece Norris, Lillian Clark, Ethan Carter, Laith Hilal, Brogan Bridges, Hunter Niemann, Caden Cornwell, Major Boland, Karter Gonzales, Asher Stumpner, Jack Brazile, Jax Christopher, Brecken Haiduk, Grayson White, Mia Schulte, Avery Underwood, Lanie Guerrero, Brooklyn Madison, Baylor Brown, Sutton Forrest" },
        { label: "Front Row (L-R)", names: "Brooklyn Carruth, Brooklynn Drager, Aliyah Perez, Lyric Powell, Analei Jimenez, Ava Solis, Aria Vaughn, Faith Ortiz, Olivia Baccari, Khloe Jolley" },
        { label: "Not Pictured", names: "George Branum" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Header */}
      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-20 text-center text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-5xl sm:text-6xl font-light tracking-widest mb-6">
            Our <span className="text-[#d4af37]">Belles & Beaux</span>
          </h1>
          <div className="h-1 w-24 bg-[#d4af37] mx-auto mb-8" />
          <p className="text-lg opacity-90 leading-relaxed max-w-2xl mx-auto font-light">
            Recognizing the exceptional young men and women of West Texas who 
            dedicate their time to community service and the preservation of the arts.
          </p>
        </div>
      </section>

      {/* Senior Teaser/Placeholder */}
      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-[#1a1a2e] text-2xl tracking-[0.2em] uppercase mb-4">Class of 2026</h2>
          <div className="inline-block px-8 py-4 bg-white border border-[#d4af37]/30 rounded shadow-sm">
            <p className="text-[#1a1a2e] font-light italic">
              Senior Class individual portraits and biographies are coming soon.
            </p>
          </div>
        </div>
      </section>

      {/* Group Sections */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 space-y-32">
          {classes.map((item, index) => (
            <div key={index} className="flex flex-col gap-10">
              {/* Image Container */}
              <div className="relative w-full md:w-3/4 mx-auto rounded-xl overflow-hidden shadow-2xl bg-gray-200">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={1400}
                  height={800}
                  className="w-full h-auto object-cover"
                />
              </div>

              {/* Names Container */}
              <div className="max-w-5xl mx-auto w-full">
                <h2 className="text-3xl font-light text-[#1a1a2e] mb-8 flex items-center gap-4">
                  <span className="text-[#d4af37] text-4xl">/</span> {item.title}
                </h2>
                
                <div className="grid gap-6">
                  {item.rows.map((row, rIndex) => (
                    <div key={rIndex} className="border-l-2 border-[#d4af37]/20 pl-6">
                      <h4 className="text-xs font-bold tracking-widest text-[#d4af37] uppercase mb-1">
                        {row.label}
                      </h4>
                      <p className="text-gray-700 leading-relaxed font-light text-sm sm:text-base">
                        {row.names}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Program Requirement / Call to Action */}
      <section className="py-20 bg-[#1a1a2e] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-2xl font-light mb-6 tracking-wide">Interested in the Belles & Beaux Program?</h3>
          <p className="opacity-80 mb-10 font-light leading-relaxed">
            The program is open to high school students in grades 9-12 who are interested 
            in supporting the arts through volunteerism. Members participate in symphony 
            events, educational workshops, and are presented at our annual Gala.
          </p>
          <a
            href="/#contact"
            className="inline-block border border-[#d4af37] text-[#d4af37] px-10 py-3 rounded hover:bg-[#d4af37] hover:text-[#1a1a2e] transition-all tracking-widest text-sm uppercase"
          >
            Inquire for Membership
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}