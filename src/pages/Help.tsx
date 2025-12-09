import { HelpCircle, Book, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const helpItems = [
  {
    icon: Book,
    title: 'Documentation',
    description: 'Learn how to use the Kvatt dashboard and integrate with your Shopify store.',
    action: 'View Docs',
    href: '#',
  },
  {
    icon: MessageCircle,
    title: 'FAQ',
    description: 'Find answers to commonly asked questions about renewable packaging.',
    action: 'View FAQ',
    href: '#',
  },
  {
    icon: Mail,
    title: 'Contact Support',
    description: 'Need help? Reach out to our support team for assistance.',
    action: 'Email Us',
    href: 'mailto:support@kvatt.com',
  },
];

const Help = () => {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help & Support</h1>
        <p className="text-sm text-muted-foreground">
          Get help with using the Kvatt admin dashboard
        </p>
      </div>

      {/* Help Cards */}
      <div className="space-y-4">
        {helpItems.map((item) => (
          <div key={item.title} className="metric-card">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                <Button variant="link" className="px-0 mt-2 gap-1" asChild>
                  <a href={item.href}>
                    {item.action}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Tips */}
      <div className="metric-card">
        <h3 className="font-semibold mb-4">Quick Tips</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Use the date range picker to filter analytics by specific time periods.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Generate labels in bulk and assign them to merchants later.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Monitor QR scans in real-time to track customer engagement.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Export data to CSV for reporting and analysis.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Help;
