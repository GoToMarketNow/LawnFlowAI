import { useDrawer } from "@/lib/drawer-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function ContextualDrawer() {
  const { content, isOpen, title, closeDrawer } = useDrawer();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {title && (
          <SheetHeader className="pb-4">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
        )}
        {content}
      </SheetContent>
    </Sheet>
  );
}
