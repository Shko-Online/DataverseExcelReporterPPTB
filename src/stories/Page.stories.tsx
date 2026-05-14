import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataverseAPIMock, ToolboxAPIMock } from '@shko.online/pptb-mock';

import App from '../App';
import { ToolboxAPIProvider } from '../context/ToolboxAPIContext';
import { DataverseAPIProvider } from '../context/DataverseAPIContext';
import { ConnectionProvider } from '../context/ConnectionContext';
import { ApplicationDataProvider } from '../context/ApplicationDataContext';
import { FetchXmlResult } from '@pptb/types/dataverseAPI';


const toolboxAPIMock = new ToolboxAPIMock();
toolboxAPIMock.utils.copyToClipboard.callsFake((text)=>{
    const clip = new Clipboard();
    return clip.writeText(text);
});

toolboxAPIMock.utils.executeParallel.callsFake((...promises)=>{
    const delay = 500+ 1000*Math.random();

    return new Promise(resolve=>{
        setTimeout(()=> resolve(Promise.all(promises)), delay) ;
    }) 
});


const dataverseAPIMock = new DataverseAPIMock();

dataverseAPIMock.retrieveMultiple.callsFake(async(fetchXML:string)=>{
    console.log(fetchXML);
    return { 
        "value": []
    } as FetchXmlResult;
})

window.toolboxAPI = toolboxAPIMock;
window.dataverseAPI = dataverseAPIMock;

const WrappedApp = () => (
    <ToolboxAPIProvider>
        <DataverseAPIProvider>
            <ConnectionProvider>
                <ApplicationDataProvider>
                    <App />
                </ApplicationDataProvider>
            </ConnectionProvider>
        </DataverseAPIProvider>
    </ToolboxAPIProvider>
);


const meta = {
    title: 'Full Tool',
    component: WrappedApp,
    parameters: {
        // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
        layout: 'fullscreen',
    },
} satisfies Meta<typeof WrappedApp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullTool: Story = {};

// // More on component testing: https://storybook.js.org/docs/writing-tests/interaction-testing
// export const LoggedIn: Story = {
//   play: async ({ canvasElement }) => {
//     const canvas = within(canvasElement);
//     const loginButton = canvas.getByRole('button', { name: /Log in/i });
//     await expect(loginButton).toBeInTheDocument();
//     await userEvent.click(loginButton);
//     await expect(loginButton).not.toBeInTheDocument();

//     const logoutButton = canvas.getByRole('button', { name: /Log out/i });
//     await expect(logoutButton).toBeInTheDocument();
//   },
// };
