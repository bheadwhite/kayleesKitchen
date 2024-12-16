import React from "react";
import { useForm, useField } from "react-final-form";
import { Checkbox as MUICheckbox, makeStyles } from "@material-ui/core";

const useStyles = makeStyles(() => ({
  checkbox: {},
}));

const TextField = (props) => {
  const classes = useStyles();
  const { change } = useForm();
  const { input, meta } = useField(props.name, {
    subscription: { touched: true, error: true, value: true },
  });
  const handleChange = (e) => {
    change(props.name, e.target.checked);
  };

  return (
    <React.Fragment>
      {props.label && <label>{props.label}:</label>}
      <MUICheckbox
        error={meta.error && meta.touched}
        autoComplete={props.name}
        onBlur={(e) => input.onBlur(e)}
        onFocus={input.onFocus}
        onChange={handleChange}
        className={classes.checkbox}
        {...props}
      />
    </React.Fragment>
  );
};

export default TextField;
