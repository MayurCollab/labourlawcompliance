import toast from 'react-hot-toast';

/** Thin wrappers so feature code never imports react-hot-toast directly. */

export const toastSuccess = (message: string) => toast.success(message);

export const toastError = (message: string) => toast.error(message);

export const toastInfo = (message: string) => toast(message);
