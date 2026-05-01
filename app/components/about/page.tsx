"use client";

import Link from "next/link";
import { useAuth } from "@/app/context/auth";
import { getFeatures, getValues } from "./values";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

const About = () => {
  const { user } = useAuth();
  const { lang } = useLang();
  const tr = t[lang];
  const features = getFeatures(tr);
  const values = getValues(tr);

  return (
    <div className="relative min-h-screen bg-(--bg-primary) text-(--text-primary) overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center gap-8 pb-10">
          <p className="text-xs tracking-[0.3em] text-(--text-primary)/40 uppercase">
            {tr.estYear}
          </p>
          <h1 className="text-7xl font-black leading-none tracking-tighter">
            <span className="block text-(--text-primary)">{tr.weBuild}</span>
            <span className="block text-(--text-primary)">
              {tr.connections}
            </span>
          </h1>
          <p className="text-(--text-primary)/60 text-lg max-w-lg leading-relaxed">
            {tr.aboutDesc}
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Link
              href={user ? "/" : "/components/login"}
              className="px-8 py-3 rounded-full font-semibold text-sm bg-(--bg-card) text-(--text-primary) hover:opacity-80 transition-all duration-200 hover:scale-105"
            >
              {tr.getStarted}
            </Link>
            <Link
              href="#mission"
              className="px-8 py-3 rounded-full font-semibold text-sm border border-(--border) text-(--text-primary)/60 hover:text-(--text-primary) transition-all duration-200"
            >
              {tr.learnMore}
            </Link>
          </div>
        </section>

        {/* Mission */}
        <section id="mission" className="py-24 border-t border-(--border)">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs tracking-[0.3em] text-(--text-primary)/60 uppercase mb-6">
                {tr.ourMission}
              </p>
              <h2 className="text-5xl font-black leading-tight mb-6">
                {tr.technologyFor}
                <span className="block text-(--text-primary)/30">
                  {tr.humanConnection}
                </span>
              </h2>
            </div>
            <p className="text-(--text-primary)/60 text-lg leading-relaxed">
              {tr.missionDesc}
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 border-t border-(--border)">
          <p className="text-xs tracking-[0.3em] text-(--text-primary)/60 uppercase mb-16">
            {tr.featuresTitle}
          </p>
          <div className="grid md:grid-cols-3 gap-px bg-(--border) rounded-3xl overflow-hidden">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="group bg-(--bg-primary) hover:bg-(--bg-secondary) p-10 transition-all duration-300"
              >
                <div className="text-3xl mb-8">{feature.icon}</div>
                <h3 className="text-lg font-bold mb-3 text-(--text-primary) transition-colors">
                  {feature.title}
                </h3>
                <p className="text-(--text-primary)/50 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="py-24 border-t border-(--border)">
          <p className="text-xs tracking-[0.3em] text-(--text-primary)/60 uppercase mb-16">
            {tr.valuesTitle}
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-6 p-8 rounded-2xl border border-(--border) hover:bg-(--bg-secondary) transition-all duration-300"
              >
                <div className="text-2xl shrink-0 mt-1">{value.icon}</div>
                <div>
                  <h3 className="font-bold text-base mb-2 text-(--text-primary) transition-colors">
                    {value.title}
                  </h3>
                  <p className="text-(--text-primary)/50 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-8 border-t border-(--border) text-center">
          <p className="text-xs tracking-[0.3em] text-(--text-primary)/40 uppercase mb-5">
            {tr.ready}
          </p>
          <h2 className="text-6xl font-black leading-none tracking-tighter mb-7.5 text-(--text-primary)">
            {tr.joinUs}
          </h2>
          <Link
            href={user ? "/" : "/components/login"}
            className="inline-flex items-center gap-3 px-12 py-3 rounded-full font-bold text-(--text-primary) bg-(--bg-card) hover:opacity-80 transition-all duration-200 hover:scale-105"
          >
            {tr.getStarted}
            <span className="text-lg">&#8594;</span>
          </Link>
        </section>
      </div>
    </div>
  );
};

export default About;
