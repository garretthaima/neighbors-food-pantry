// Every stylesheet, in cascade order. A later file wins over an earlier one,
// so a new file goes next to its neighbours, not at the end by default.
import '@fontsource-variable/archivo/wdth.css';
import '@/shared/ui/tokens.css';
import '@/shared/ui/base.css';
import '@/shared/ui/button.css';
import '@/shared/ui/badge.css';
import '@/shared/ui/card.css';
import '@/shared/ui/form-field.css';
import '@/shared/ui/segmented.css';
import '@/shared/ui/panel.css';
import '@/shared/ui/feedback.css';
import '@/shared/ui/toast.css';
import '@/shared/ui/motion.css';
import './shell.css';
import '@/shared/ui/page.css';
import '@/features/inventory/shelves.css';
import '@/shared/ui/rows.css';
import '@/features/scan/scan.css';
import '@/features/activity/activity.css';
import '@/features/auth/gate.css';
import '@/shared/ui/forms.css';
import '@/features/inventory/shelf-manager.css';
import '@/shared/ui/skeleton-rows.css';
// Phone overrides for all of the above. Keep last.
import './phone.css';
