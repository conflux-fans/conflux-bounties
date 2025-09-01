'use client';

import { Shield, ArrowLeft, Zap, FileText, Search, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import './features.css';

export default function FeaturesPage() {
  return (
    <div className="container">
      {/* Header */}
      <div className="features-header">
        <Link href="/" className="back-link">
          <ArrowLeft className="icon-small mr-2" />
          Back to Auditor
        </Link>
        <div className="header-content">
          <div className="icon-container">
            <div className="hero-icon">
              <Shield className="icon-large" />
            </div>
          </div>
          <h1 className="main-heading">
            Audit
            <span className="gradient-text"> Features</span>
          </h1>
          <p className="hero-description">
            Comprehensive AI-powered security analysis capabilities for smart contracts
          </p>
        </div>
      </div>

      <div className="features-content">
        {/* Core Features Grid */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Shield className="feature-icon" />
            </div>
            <h3 className="feature-title">Security Analysis</h3>
            <p className="feature-description">
              Advanced vulnerability detection including reentrancy attacks, integer overflow/underflow, 
              access control issues, and other critical security flaws that could compromise your contract.
            </p>
            <div className="feature-tags">
              <span className="tag">Reentrancy</span>
              <span className="tag">Access Control</span>
              <span className="tag">Integer Overflow</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <TrendingUp className="feature-icon" />
            </div>
            <h3 className="feature-title">Gas Optimization</h3>
            <p className="feature-description">
              Identify inefficient patterns, redundant computations, and suboptimal data structures 
              to help reduce transaction costs and improve contract performance.
            </p>
            <div className="feature-tags">
              <span className="tag">Loop Optimization</span>
              <span className="tag">Storage Efficiency</span>
              <span className="tag">Function Modifiers</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <FileText className="feature-icon" />
            </div>
            <h3 className="feature-title">Code Quality</h3>
            <p className="feature-description">
              Comprehensive code review covering naming conventions, documentation standards, 
              unused variables, and maintainability improvements for better code quality.
            </p>
            <div className="feature-tags">
              <span className="tag">Documentation</span>
              <span className="tag">Best Practices</span>
              <span className="tag">Maintainability</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Zap className="feature-icon" />
            </div>
            <h3 className="feature-title">AI-Powered Analysis</h3>
            <p className="feature-description">
              State-of-the-art artificial intelligence models trained on extensive smart contract 
              datasets to provide accurate, context-aware security analysis and recommendations.
            </p>
            <div className="feature-tags">
              <span className="tag">GPT-4 Analysis</span>
              <span className="tag">Pattern Recognition</span>
              <span className="tag">ML Detection</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Search className="feature-icon" />
            </div>
            <h3 className="feature-title">Static Analysis Tools</h3>
            <p className="feature-description">
              Integration with industry-standard tools like Slither and Mythril for comprehensive 
              static analysis, providing multiple layers of security verification.
            </p>
            <div className="feature-tags">
              <span className="tag">Slither</span>
              <span className="tag">Mythril</span>
              <span className="tag">Multi-tool</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <FileText className="feature-icon" />
            </div>
            <h3 className="feature-title">Detailed Reports</h3>
            <p className="feature-description">
              Comprehensive audit reports with severity classifications, code snippets, 
              line-by-line analysis, and actionable remediation recommendations.
            </p>
            <div className="feature-tags">
              <span className="tag">JSON Export</span>
              <span className="tag">Markdown Format</span>
              <span className="tag">SWC/CWE IDs</span>
            </div>
          </div>
        </div>

        {/* Technical Specifications */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title gradient-text">Technical Specifications</h2>
            <p className="card-description">
              Advanced capabilities and supported standards
            </p>
          </div>
          <div className="card-content">
            <div className="spec-grid">
              <div className="spec-item">
                <h4 className="spec-title">Supported Networks</h4>
                <p className="spec-description">Conflux Core, Conflux eSpace, Ethereum</p>
              </div>
              <div className="spec-item">
                <h4 className="spec-title">Analysis Standards</h4>
                <p className="spec-description">SWC Registry, CWE Database, OWASP Top 10</p>
              </div>
              <div className="spec-item">
                <h4 className="spec-title">Output Formats</h4>
                <p className="spec-description">JSON, Markdown, PDF (coming soon)</p>
              </div>
              <div className="spec-item">
                <h4 className="spec-title">Processing Speed</h4>
                <p className="spec-description">~2-5 minutes per contract</p>
              </div>
            </div>
          </div>
        </div>

        {/* Get Started */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title gradient-text">Ready to Secure Your Contract?</h2>
            <p className="card-description">
              Start auditing your smart contracts with our comprehensive AI-powered analysis
            </p>
          </div>
          <div className="card-content">
            <div className="cta-actions">
              <Link href="/">
                <button className="btn btn-primary btn-lg">
                  <Shield className="icon-small mr-2" />
                  Start Audit
                </button>
              </Link>
              <Link href="/history">
                <button className="btn btn-secondary btn-lg">
                  <FileText className="icon-small mr-2" />
                  View History
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}