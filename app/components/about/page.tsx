"use client";

import Link from "next/link";
import { useAuth } from "@/app/context/auth";
import { features, values } from "./values";

const AboutPage = () => {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen bg-[#1c1c1e] text-white overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center gap-8 pb-10">
          <p className="text-xs tracking-[0.3em] text-white/30 uppercase">
            Est. 2026
          </p>
          <h1 className="text-7xl font-black leading-none tracking-tighter">
            <span className="block text-white">We Build</span>
            <span className="block">Connections</span>
          </h1>
          <p className="text-white/40 text-lg max-w-lg leading-relaxed">
            A space to express, discover, and connect — built for the people who
            make the internet worth exploring.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Link
              href={user ? "/" : "/auth/login"}
              className="px-8 py-3 rounded-full font-semibold text-sm bg-gray-100 text-[#1c1c1e] hover:bg-white/90 transition-all duration-200 hover:scale-105"
            >
              Get Started
            </Link>
            <a
              href="#mission"
              className="px-8 py-3 rounded-full font-semibold text-sm border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all duration-200"
            >
              Learn More
            </a>
          </div>
        </section>

        {/* Mission */}
        <section id="mission" className="py-24 border-t border-white/5">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs tracking-[0.3em] text-white uppercase mb-6">
                Our Mission
              </p>
              <h2 className="text-5xl font-black leading-tight mb-6">
                Technology for
                <span className="block text-white/30">Human Connection</span>
              </h2>
            </div>
            <p className="text-white/40 text-lg leading-relaxed">
              To connect people around the world by providing a safe and
              convenient platform for communication, sharing ideas, and
              creativity. We believe technology should serve human connections,
              not divide them.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 border-t border-white/5">
          <p className="text-xs tracking-[0.3em] text-white uppercase mb-16">
            Features
          </p>
          <div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-3xl overflow-hidden">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="group bg-[#1c1c1e] hover:bg-white/1 p-10 transition-all duration-300"
              >
                <div className="text-3xl mb-8">{feature.icon}</div>
                <h3 className="text-lg font-bold mb-3 group-hover:text-gray-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-white/30 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="py-24 border-t border-white/5">
          <p className="text-xs tracking-[0.3em] text-white uppercase mb-16">
            Values
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-6 p-8 rounded-2xl border border-white/5 hover:border-gray-500/20 hover:bg-white/11 transition-all duration-300"
              >
                <div className="text-2xl shrink-0 mt-1">{value.icon}</div>
                <div>
                  <h3 className="font-bold text-base mb-2 group-hover:text-gray-300 transition-colors">
                    {value.title}
                  </h3>
                  <p className="text-white/30 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-8 border-t border-white/5 text-center">
          <p className="text-xs tracking-[0.3em] text-white/20 uppercase mb-5">
            Ready?
          </p>
          <h2 className="text-6xl font-black leading-none tracking-tighter mb-7.5">
            Join Us
          </h2>
          <Link
            href={user ? "/" : "/auth/login"}
            className="inline-flex items-center gap-3 px-12 py-3 rounded-full font-bold text-[#1c1c1e] bg-gray-100 hover:bg-white/90 transition-all duration-200 hover:scale-105 shadow-2xl shadow-white/10"
          >
            Get Started
            <span className="text-lg">→</span>
          </Link>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
