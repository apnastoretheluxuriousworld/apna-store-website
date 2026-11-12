// Animation engine for <m.*> components, loaded on its own after the page's
// first JavaScript (see motion-provider.tsx). domMax = animations + gestures +
// drag (the hero and the menu sheet are draggable).
import { domMax } from "motion/react";

export default domMax;
