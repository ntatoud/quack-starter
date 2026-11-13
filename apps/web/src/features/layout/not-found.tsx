/** What a path with no route renders, inside the layout. */
export function NotFound() {
  return (
    <>
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">This page does not exist.</p>
    </>
  );
}
