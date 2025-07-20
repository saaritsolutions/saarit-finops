# Generic & Reusable Components Documentation

This document lists all generic and reusable components, directives, and services available in the Saar Core Banking Solution UI. Update this file as new reusable elements are added.

---

## 1. SpinnerComponent
- **Path:** `src/app/shared/spinner.component.ts`
- **Description:** Displays a loading spinner during route navigation or async operations. Can be used anywhere in the app to indicate loading state.
- **Usage:** `<app-spinner></app-spinner>`

## 2. Accordion Directives
- **Path:** `src/app/shared/accordion/`
- **Description:** Provides a reusable accordion (expand/collapse) UI pattern for menus or content sections.
- **Directives:**
  - `AccordionDirective` (`[appAccordion]`)
  - `AccordionLinkDirective` (`[appAccordionLink]`)
  - `AccordionAnchorDirective` (`[appAccordionToggle]`)
- **Usage:** Apply these directives to elements to create collapsible/expandable sections.

## 3. MenuItems Service
- **Path:** `src/app/shared/menu-items/menu-items.ts`
- **Description:** Injectable service providing menu/navigation items for the application. Centralizes menu configuration.

## 4. SharedModule
- **Path:** `src/app/shared/shared.module.ts`
- **Description:** Bundles and exports shared directives and services for use across the app. Import this module in feature modules to access shared functionality.

---

## Guidelines for Creating Generic Components
- Place all generic/reusable components, directives, and services in the `shared` module/folder.
- Document each new reusable element in this file with path, description, and usage.
- Prefer generic, configurable inputs/outputs for maximum reusability.
- Keep business logic out of shared components; focus on UI and utility logic.

---

**Note:**
- Update this file regularly as new reusable components are developed.
- Review existing shared components before creating new ones to avoid duplication.
