// src/components/layout/footer.tsx
import Link from "next/link";
import { Coins, Github, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and description */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Coins className="h-8 w-8" />
              <span className="font-bold text-xl">VestingDApp</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              The most comprehensive platform for deploying ERC20 tokens with
              smart vesting schedules. Built for teams, investors, and
              communities.
            </p>
            <div className="flex space-x-4">
              <Link
                href="https://github.com"
                className="text-muted-foreground hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </Link>
              <Link
                href="https://twitter.com"
                className="text-muted-foreground hover:text-foreground"
              >
                <Twitter className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/deploy"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Deploy Token
                </Link>
              </li>
              <li>
                <Link
                  href="/batch"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Batch Deploy
                </Link>
              </li>
              <li>
                <Link
                  href="/analytics"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Analytics
                </Link>
              </li>
              <li>
                <Link
                  href="/beneficiary"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Beneficiary Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Support links */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/docs"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/guides"
                  className="text-muted-foreground hover:text-foreground"
                >
                  User Guides
                </Link>
              </li>
              <li>
                <Link
                  href="/api"
                  className="text-muted-foreground hover:text-foreground"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
          <p>&copy; {currentYear} VestingDApp. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
