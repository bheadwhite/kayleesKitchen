import React from "react";
import { useForm, useField } from "react-final-form";
import { TextField as MUITextField, makeStyles } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  textField: {
    maxWidth: 380,
    margin: theme.spacing(1, 0),
    "& input": {
      padding: theme.spacing(3),
    },
    "& label": {
      transform: "translate(14px, 18px) scale(1)",
    },
  },
}));

export interface TextFieldProps {
  id?: string;
  name: string;
  inputProps?: React.HTMLProps<HTMLInputElement>;
  label?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  fullWidth?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const TextField = React.forwardRef<HTMLDivElement, TextFieldProps>(
  (props, ref) => {
    const classes = useStyles();
    const { change } = useForm();
    const { input: inputField, meta } = useField(props.name, {
      subscription: { touched: true, error: true, value: true },
    });
    const handleChange = (e) => {
      change(props.name, e.target.value);
      if (props.onChange != null) {
        props.onChange(e);
      }
    };

    return (
      <MUITextField
        id={props.id}
        error={meta.error && meta.touched}
        variant="outlined"
        fullWidth={props.fullWidth}
        autoComplete={props.name}
        type={props.type}
        onBlur={(e) => inputField.onBlur(e)}
        inputProps={props.inputProps}
        ref={ref}
        onFocus={inputField.onFocus}
        onChange={handleChange}
        className={classes.textField}
        {...props}
      />
    );
  },
);

export default TextField;
