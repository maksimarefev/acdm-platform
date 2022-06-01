import { ethers } from "ethers";

const spendFeeAbi = [{
    "inputs": [{
        "internalType": "bool",
        "name": "sendToOwner",
        "type": "bool"
    }],
    "name": "spendFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}];

const iface = new ethers.utils.Interface(spendFeeAbi);
const sendToOwner: boolean = true;
console.log(iface.encodeFunctionData("spendFees", [sendToOwner]));
