interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button(props: ButtonProps) {
  return <button onClick={props.onClick}>{props.label}</button>;
}

class App {
  render() {
    return <Button label="Click" onClick={() => {}} />;
  }
}
