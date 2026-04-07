import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Sparkles,
  Users,
  Zap,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/images/aptino-logo.png" alt="Aptino" className="w-8 h-8" />
              <span className="text-xl font-bold text-gray-900">Aptino</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="btn-primary text-sm"
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 gradient-hero overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4" />
              AI-Powered Recruitment Platform
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
              Hire Better,
              <span className="block text-gradient">Faster Than Ever</span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              AI-powered candidate scoring, intelligent ranking, and deep analytics.
              Transform your hiring workflow from days to minutes.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="btn-primary btn-lg shadow-xl shadow-primary-500/25 hover:shadow-2xl hover:shadow-primary-500/30 hover:-translate-y-0.5 transition-all"
              >
                Sign In
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Social Proof */}
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-500" />
                <span>AI-Powered Scoring</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-500" />
                <span>Smart Ranking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-500" />
                <span>Analytics Ready</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10x', label: 'Faster Screening' },
              { value: '95%', label: 'Accuracy Rate' },
              { value: '500K+', label: 'Resumes Processed' },
              { value: '24/7', label: 'AI Availability' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-gradient">{stat.value}</div>
                <div className="text-sm text-gray-600 mt-2 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-gray-900">
              Everything You Need to{' '}
              <span className="text-gradient">Hire Smarter</span>
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful AI-driven features that streamline your entire recruitment workflow
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                iconBg: 'from-violet-500 to-purple-600',
                title: 'AI Candidate Scoring',
                description: 'Intelligent scoring based on job requirements, skills matching, and experience relevance.',
              },
              {
                icon: Target,
                iconBg: 'from-blue-500 to-cyan-600',
                title: 'Smart Ranking',
                description: 'Automatic candidate ranking with AI-powered insights and consistency checks.',
              },
              {
                icon: Users,
                iconBg: 'from-emerald-500 to-teal-600',
                title: 'Session Management',
                description: 'Organize hiring by client and role. Track multiple positions simultaneously.',
              },
              {
                icon: BarChart3,
                iconBg: 'from-orange-500 to-amber-600',
                title: 'Performance Analytics',
                description: 'Real-time dashboards showing conversion rates, time-to-hire, and recruiter metrics.',
              },
              {
                icon: Shield,
                iconBg: 'from-rose-500 to-pink-600',
                title: 'LinkedIn Verification',
                description: 'Cross-reference resumes with LinkedIn profiles to ensure candidate authenticity.',
              },
              {
                icon: Zap,
                iconBg: 'from-indigo-500 to-blue-600',
                title: 'Bulk Processing',
                description: 'Upload and process hundreds of candidates simultaneously with our AI pipeline.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group card p-6 hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.iconBg} p-3 text-white shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-full h-full" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-gray-900">
              How It{' '}
              <span className="text-gradient">Works</span>
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Get from job description to ranked candidates in three simple steps
            </p>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: 'Create Session',
                description: 'Set up a hiring session with your client name and job description.',
                icon: FileText,
              },
              {
                step: 2,
                title: 'Upload Candidates',
                description: 'Bulk upload candidate CVs and LinkedIn profiles in seconds.',
                icon: Upload,
              },
              {
                step: 3,
                title: 'Get AI Insights',
                description: 'Receive detailed scores, rankings, and hiring recommendations instantly.',
                icon: TrendingUp,
              },
            ].map(({ step, title, description, icon: Icon }) => (
              <div key={step} className="relative">
                {/* Connector Line */}
                {step < 3 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary-200 to-primary-100" />
                )}

                <div className="relative card p-8 text-center hover:shadow-lg transition-shadow">
                  {/* Step Number */}
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold flex items-center justify-center text-lg shadow-lg shadow-primary-500/30">
                    {step}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 mt-4">
                    <Icon className="w-8 h-8 text-primary-600" />
                  </div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
                  <p className="text-gray-600">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="card p-12 bg-gradient-to-br from-primary-600 to-primary-700 border-none shadow-2xl shadow-primary-500/25">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Hiring?
            </h2>
            <p className="text-primary-100 text-lg mb-8 max-w-2xl mx-auto">
              Join hundreds of recruiters who save hours every week with AI-powered candidate evaluation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="group relative btn-lg bg-white text-primary-700 hover:bg-primary-50 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
            </div>
            <p className="text-primary-200 text-sm mt-6">
              Secure login • Role-based access • Analytics ready
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/images/aptino-logo.png" alt="Aptino" className="w-6 h-6" />
              <span className="font-bold text-gray-900">Aptino</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8 text-sm text-gray-600">
              <a href="#" className="hover:text-gray-900 transition-colors">Terms</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Contact</a>
            </div>

            {/* Copyright */}
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Aptino. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Icons for steps
function FileText({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function Upload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}
