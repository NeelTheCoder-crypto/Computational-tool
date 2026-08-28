import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-2">
            <AlertCircle className="h-7 w-7 text-destructive" />
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Page not found
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            That page doesn’t exist.{' '}
            <Link href="/" className="text-primary hover:underline">
              Return to the Carrier Finder
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
