import { createContext, useContext } from 'react';
import type { PickResultData } from '@/types';

interface PickActions {
    /** Switch to the Assert tab with the picked element filled in */
    openInAssert: (pick: PickResultData) => void;
}

export const PickActionsContext = createContext<PickActions>({ openInAssert: () => {} });

export function usePickActions() {
    return useContext(PickActionsContext);
}
