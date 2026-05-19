import { useState, useRef, useEffect } from "react";
import styles from "./DatePickerButton.module.css";

export default function DatePickerButton({ onSelect }) {
  const [picked, setPicked] = useState("");
  const cbRef = useRef(onSelect);

  useEffect(() => { 
    cbRef.current = onSelect; 
  });

  return (
    <div className={styles.wrapper}>
      <input
        type="date"
        value={picked}
        onChange={e => setPicked(e.target.value)}
        className={styles.input}
        placeholder="Personalizado"
      />
      {picked && (
        <button
          onClick={() => { 
            cbRef.current(picked); 
            setPicked(""); 
          }}
          className={styles.confirmBtn}
        >
          ok
        </button>
      )}
    </div>
  );
}
