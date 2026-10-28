import { handleOverlayWheel } from "../lib/overlayScroll";
import { users } from "../data/users";
import { employeeAssignmentSchema, type User } from "../schema/user";
import { cx } from "../styles";
import PersonFace from "./PersonFace";

type Props = {
  name: string;
  email?: string;
  onChange: (next: { name: string; email: string }) => void;
};

function samePerson(person: User, name: string, email: string) {
  const byEmail = email && person.email.toLowerCase() === email.toLowerCase();
  const byName = name && person.name.toLowerCase() === name.toLowerCase();
  return Boolean(byEmail || (!email && byName));
}

function PersonBall({
  person,
  active,
  onSelect,
}: {
  person: User;
  active: boolean;
  onSelect: () => void;
}) {
  const label = `${person.name} (${person.email})`;
  return (
    <li>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        className={cx(
          "inline-flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border-0 bg-transparent p-0 hover:brightness-105",
          active && "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--card)]",
        )}
        onClick={onSelect}
      >
        <PersonFace name={person.name} email={person.email} />
      </button>
    </li>
  );
}

export default function EmployeePicker({ name, email = "", onChange }: Props) {
  const selected = name.trim();

  function pick(person: User) {
    if (samePerson(person, selected, email)) {
      onChange(employeeAssignmentSchema.parse({ name: "", email: "" }));
      return;
    }
    onChange(employeeAssignmentSchema.parse({ name: person.name, email: person.email }));
  }

  return (
    <div className="employee-picker">
      <ul
        className="m-0 flex max-h-32 list-none flex-wrap content-start gap-1.5 overflow-auto p-0"
        onWheel={handleOverlayWheel}
        role="group"
        aria-label="Users"
      >
        {users.map((person) => (
          <PersonBall
            key={person.objectId}
            person={person}
            active={samePerson(person, selected, email)}
            onSelect={() => pick(person)}
          />
        ))}
      </ul>
    </div>
  );
}
