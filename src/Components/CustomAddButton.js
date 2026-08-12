import Button from "./Common/Button";

const CustomAddButton = ({onPress}) => {
    return (
        <Button onPress={onPress} type="custom" elementType="text">
           <Text>+</Text>
        </Button>
    );
};

export default CustomAddButton;