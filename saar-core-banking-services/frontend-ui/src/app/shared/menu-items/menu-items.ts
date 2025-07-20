//todo cleanup
import { Injectable } from '@angular/core';

export interface Menu {
  state: string;
  name: string;
  type: string;
  icon: string;
  entity:string;
}

const MENUITEMS = [
  { state: 'dashboard', name: 'Dashboard', type: 'link', icon: 'av_timer' ,entity: 'NA'},
  { state: 'shareholder', type: 'link', name: 'Share Holder', icon: 'crop_7_5',entity: 'shareholder' },
  { state: 'customer', type: 'link', name: 'Investor', icon: 'view_comfy',entity: 'investor' },
  { state: 'deposit', type: 'link', name: 'Deposit', icon: 'view_list',entity: 'deposit' },
  { state: 'accounting', type: 'link', name: 'Accounting', icon: 'view_headline',entity: 'NA' },
  { state: 'reports', type: 'link', name: 'Reports', icon: 'tab' ,entity: 'NA'},
  { state: 'admin', type: 'link', name: 'Admin', icon: 'web' ,entity: 'NA'},
  { state: 'search', type: 'link', name: 'Search',icon: 'vertical_align_center', entity: 'NA'  },
  { state: 'customer/create', type: 'link', name: 'Create Customer', icon: 'person_add', entity: 'customer' },
  { state: 'customer/create-generic', type: 'link', name: 'Create Customer (Generic)', icon: 'person_add_alt', entity: 'customer' }
  // // },
  // { state: 'chips', type: 'link', name: 'Chips', icon: 'vignette' },
  // { state: 'toolbar', type: 'link', name: 'Toolbar', icon: 'voicemail' },
  // {
  //   state: 'progress-snipper',
  //   type: 'link',
  //   name: 'Progress snipper',
  //   icon: 'border_horizontal'
  // },
  // {
  //   state: 'progress',
  //   type: 'link',
  //   name: 'Progress Bar',
  //   icon: 'blur_circular'
  // },
  // {
  //   state: 'dialog',
  //   type: 'link',
  //   name: 'Dialog',
  //   icon: 'assignment_turned_in'
  // },
  // { state: 'tooltip', type: 'link', name: 'Tooltip', icon: 'assistant' },
  // { state: 'snackbar', type: 'link', name: 'Snackbar', icon: 'adb' },
  // { state: 'slider', type: 'link', name: 'Slider', icon: 'developer_mode' },
  // {
  //   state: 'slide-toggle',
  //   type: 'link',
  //   name: 'Slide Toggle',
  //   icon: 'all_inclusive'
  // }
];

@Injectable()
export class MenuItems {
  getMenuitem(): Menu[] {
    return MENUITEMS;
  }
}
