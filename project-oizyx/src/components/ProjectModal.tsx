"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";

export default function ProjectModal() {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Dialog>
                <DialogTrigger asChild>
                    <Button size="lg" variant="outline">
                        Suggestion
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Suggestion Box</DialogTitle>
                        <DialogDescription>
                            Our Psychology representator can suggest the best course of action for this.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogClose asChild>
                        <Button variant="ghost">Close</Button>
                    </DialogClose>
                </DialogContent>
            </Dialog>
        </div>
    );
}
