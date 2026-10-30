import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Inbox, ArrowLeft, ArrowRight } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: any[]) => twMerge(clsx(inputs));
const variants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Button({
  variant = "default",
  asChild = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "danger";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(variants({ variant }), className)} {...props} />;
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  drawer?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={cn(
            "modal",
            wide && "modal-wide",
            drawer && "modal-drawer",
          )}
          aria-describedby={undefined}
        >
          <div className="modal-head">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Đóng">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  let labelled = false;
  const associate = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (node) => {
      if (!isValidElement(node)) return node;
      const el = node as React.ReactElement<any>;
      if (
        !labelled &&
        ["input", "select", "textarea"].includes(String(el.type))
      ) {
        labelled = true;
        return cloneElement(el, { id });
      }
      return el.props.children
        ? cloneElement(el, { children: associate(el.props.children) })
        : el;
    });
  const controls = associate(children);
  return (
    <div
      className="field"
      {...(!labelled
        ? { role: "group", "aria-labelledby": id + "-label" }
        : {})}
    >
      <label id={id + "-label"} htmlFor={labelled ? id : undefined}>
        {label}
      </label>
      {controls}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-block" aria-live="polite">
      <Loader2 className="spin" />
      <span>Đang tải dữ liệu…</span>
      <div className="loading-skeleton" aria-hidden="true">
        <div className="skeleton-heading" />
        <div className="skeleton-line" />
        <div className="skeleton-cards">
          <div />
          <div />
          <div />
        </div>
      </div>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: any;
  retry?: () => void;
}) {
  return (
    <div className="empty-state">
      <Inbox />
      <h3>Chưa thể tải dữ liệu</h3>
      <p>{error?.message || "Kiểm tra kết nối backend."}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  text = "Thêm bản ghi đầu tiên để bắt đầu.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Pager({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total} kết quả · Trang {page}/{Math.max(1, Math.ceil(total / limit))}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={15} />
        </Button>
        <Button
          variant="secondary"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function Confirm({
  open,
  onClose,
  onConfirm,
  title = "Xóa bản ghi này?",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="muted">Thao tác sẽ cập nhật dữ liệu của bạn.</p>
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button variant="danger" disabled={pending} onClick={onConfirm}>
          Xác nhận
        </Button>
      </div>
    </Modal>
  );
}
