import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

/**
 * Schermata unica per gli utenti non autenticati. Messaggio volutamente
 * GENERICO: niente riferimenti all'infrastruttura (provider, pannello, ecc.)
 * per non esporre informazioni a chi non ha accesso.
 */
export function Unauthenticated() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-heading text-lg font-semibold tracking-tight">Accesso richiesto</p>
          <p className="text-sm text-muted-foreground">
            Effettua l&apos;accesso per continuare.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
