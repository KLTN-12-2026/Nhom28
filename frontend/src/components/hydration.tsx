import { useState } from "react";
import { Droplets, Plus, Undo2, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useData, useWrite, write, number } from "../lib/api";
import { Button, Field, Modal, Loading, ErrorState } from "./ui";
export function HydrationCard({ date }: { date: string }) {
  const q = useData("hydration", "/hydration?date=" + date),
    [open, setOpen] = useState(false),
    [goal, setGoal] = useState(2000),
    [custom, setCustom] = useState(false),
    [amount, setAmount] = useState(300);
  const add = useWrite(
      (d) => write("/hydration", { date, amountMl: d }),
      "Đã ghi nhận nước uống.",
    ),
    undo = useWrite(
      (id) => write("/hydration/" + id, undefined, "DELETE"),
      "Đã hoàn tác lần ghi nhận.",
    ),
    update = useWrite(
      (d) => write("/hydration/goal", { goalMl: d }, "PUT"),
      "Đã cập nhật mục tiêu nước uống.",
    );
  if (q.isPending)
    return (
      <section className="card hydration-panel">
        <Loading />
      </section>
    );
  if (q.error)
    return (
      <section className="card hydration-panel">
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </section>
    );
  const d = q.data.data,
    percent = Math.min(100, (d.totalMl / d.goalMl) * 100);
  return (
    <>
      <section className="card hydration-panel">
        <div className="hydration-heading">
          <span className="icon-tile">
            <Droplets size={22} />
          </span>
          <div>
            <h3>Một ngụm nước, một chút quan tâm.</h3>
            <p>Ghi lại lượng bạn thực sự uống trong ngày.</p>
          </div>
          <button
            onClick={() => {
              setGoal(d.goalMl);
              setOpen(true);
            }}
          >
            Đổi mục tiêu
          </button>
        </div>
        <div className="hydration-progress">
          <div className="water-cup">
            <div style={{ height: percent + "%" }} />
            <Droplets />
          </div>
          <div className="hydration-amount">
            <AnimatePresence mode="wait">
              <motion.strong
                key={d.totalMl}
                initial={{ opacity: 0.6, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {number(d.totalMl)}
                <small>/ {number(d.goalMl)} ml</small>
              </motion.strong>
            </AnimatePresence>
            <span>
              {Math.round((d.totalMl / d.goalMl) * 100)}% mục tiêu tự đặt ·{" "}
              {d.entries.length} lần ghi nhận
            </span>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Tiến độ nước uống"
              aria-valuenow={d.totalMl}
              aria-valuemin={0}
              aria-valuemax={Math.max(d.goalMl, d.totalMl)}
            >
              <div style={{ width: percent + "%" }} />
            </div>
          </div>
        </div>
        <div className="hydration-actions">
          <button disabled={add.isPending} onClick={() => add.mutate(250)}>
            <Plus size={13} />
            250 ml
          </button>
          <button disabled={add.isPending} onClick={() => add.mutate(500)}>
            <Plus size={13} />
            500 ml
          </button>
          <button
            onClick={() => setCustom(true)}
            aria-label="Nhập lượng nước khác"
          >
            <Plus size={13} />
            Khác
          </button>
          <button
            disabled={!d.entries.length || undo.isPending}
            aria-label="Hoàn tác lần uống gần nhất"
            onClick={() => undo.mutate(d.entries[0].id)}
          >
            <Undo2 size={16} />
          </button>
        </div>
        <p className="note">
          Mục tiêu khởi tạo là giá trị minh họa, bạn có thể tự đặt theo nhu cầu
          và hướng dẫn riêng.
        </p>
      </section>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mục tiêu nước uống của bạn"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(goal, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Mục tiêu tự đặt (ml/ngày)">
            <input
              type="number"
              min="250"
              max="8000"
              step="50"
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              required
            />
          </Field>
          <p className="note">
            Đây là công cụ theo dõi. Ứng dụng không tự xác định nhu cầu nước cá
            nhân; nếu có chỉ dẫn y tế, hãy dùng mục tiêu phù hợp với chỉ dẫn đó.
          </p>
          <Button disabled={update.isPending}>
            <Check size={16} />
            Lưu mục tiêu
          </Button>
        </form>
      </Modal>
      <Modal
        open={custom}
        onClose={() => setCustom(false)}
        title="Ghi nhận lượng nước"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(amount, { onSuccess: () => setCustom(false) });
          }}
        >
          <Field label="Lượng vừa uống (ml)">
            <input
              type="number"
              min="50"
              max="1000"
              step="10"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </Field>
          <Button disabled={add.isPending}>Thêm vào ngày đã chọn</Button>
        </form>
      </Modal>
    </>
  );
}
