const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-foreground">Your App</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {/* Your content goes here */}
      </main>
      
      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-sm text-muted-foreground text-center">Built with Lovable</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
