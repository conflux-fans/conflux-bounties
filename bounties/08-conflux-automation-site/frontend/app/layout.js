import './globals.css'

export const metadata = {
  title: 'Conflux Automation',
  description: 'Non-custodial limit orders and DCA strategies on Conflux eSpace',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
